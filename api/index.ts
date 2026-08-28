import express from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), "data");
const AGREEMENTS_FILE = path.join(DATA_DIR, "agreements.json");
const CLOSURES_FILE = path.join(DATA_DIR, "closures.json");
const COMPLAINTS_FILE = path.join(DATA_DIR, "complaints.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "inquiries.json");
const DEBTORS_FILE = path.join(DATA_DIR, "debtors.json");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const RETURNS_FILE = path.join(DATA_DIR, "returns.json");
const VALIDATIONS_FILE = path.join(DATA_DIR, "validations.json");
const VALIDATION_DRAFTS_FILE = path.join(DATA_DIR, "validation_drafts.json");
const LOG_FILE = path.join(DATA_DIR, "server.log");

// Ensure data directory exists early for logging
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create DATA_DIR on startup (may be read-only filesystem):", e);
}

// Logging utility - Optimized to avoid reading entire file on every log
const logToFile = (message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(logEntry.trim());
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.appendFileSync(LOG_FILE, logEntry);
    }
  } catch (e) {
    // Gracefully handle read-only filesystems
  }
};

const readJsonArrayFile = async (filePath: string): Promise<any[]> => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = await fs.promises.readFile(filePath, "utf-8");
    if (!data || !data.trim()) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logToFile(`Warning reading json array file ${filePath}: ${err}`);
    return [];
  }
};

// Load environment variables from .env file
dotenv.config();

logToFile("[Server] Entry point reached.");
logToFile(`[Server] Environment Variable Keys: ${Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("SECRET") && !k.includes("PASSWORD")).join(", ")}`);
const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const sKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
logToFile(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
logToFile(`[Server] Supabase URL configured: ${!!sUrl} ${sUrl ? `(${sUrl.substring(0, 15)}...)` : "(empty)"}`);
logToFile(`[Server] Supabase Key configured: ${!!sKey} ${sKey ? `(${sKey.substring(0, 10)}...)` : "(empty)"}`);

// Periodic log rotation (every hour) to keep file size manageable
setInterval(() => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 1024 * 1024) { // 1MB limit
        const logs = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
        if (logs.length > 1000) {
          fs.writeFileSync(LOG_FILE, logs.slice(-1000).join('\n'));
        }
      }
    }
  } catch (e) {
    console.error("Log rotation failed:", e);
  }
}, 3600000);

async function startServer() {
  logToFile("[Server] startServer() called");
  try {
    const app = express();
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    logToFile("[Server] Initializing middleware...");

    // Middleware FIRST - Ensure all routes benefit from CORS, compression and body parsing
    app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
    logToFile("[Server] CORS middleware added.");
    app.use(compression());
    logToFile("[Server] Compression middleware added.");
    app.use(express.json({ limit: '50mb' }));
    logToFile("[Server] JSON middleware added.");
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    logToFile("[Server] URLencoded middleware added.");
    app.use(cookieParser());
    logToFile("[Server] CookieParser middleware added.");

    // Request Logger - log API and page requests, excluding individual static bundle assets to keep logs clean
    app.use((req, res, next) => {
      const isStaticSubresource = 
        req.url.endsWith(".tsx") || 
        req.url.endsWith(".ts") || 
        req.url.endsWith(".css") || 
        req.url.endsWith(".js") || 
        req.url.includes("@vite") || 
        req.url.includes("@react") || 
        req.url.includes("node_modules");

      if (!isStaticSubresource) {
        logToFile(`[Request] ${req.method} ${req.url}`);
      }
      next();
    });

    logToFile("[Server] Registering API routes...");
    
    app.get("/api/debug-env", (req, res) => {
      logToFile("[API] Serving /api/debug-env");
      res.json({
        NODE_ENV: process.env.NODE_ENV,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? "SET" : "NOT SET",
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? "SET" : "NOT SET",
        PORT: process.env.PORT,
        APP_URL: process.env.APP_URL
      });
    });

    app.get("/api/config", (req, res) => {
      const sUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const sKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
      
      logToFile(`[API] Serving /api/config. Configured: ${!!(sUrl && sKey)}`);
      res.json({
        VITE_SUPABASE_URL: sUrl,
        VITE_SUPABASE_ANON_KEY: sKey
      });
    });

    app.get("/api/health", (req, res) => {
      logToFile("[API] Serving /api/health");
      let writable = false;
      try {
        const testFile = path.join(DATA_DIR, ".write_test");
        fs.writeFileSync(testFile, "test");
        fs.unlinkSync(testFile);
        writable = true;
      } catch (e) {
        logToFile(`[API] Health check write test failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      const supabaseConfigured = !!(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      ) && !!(
        process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
      );

      const googleConfigured = !!(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
      );

      logToFile(`[API] Health check result: writable=${writable}, supabaseConfigured=${supabaseConfigured}, googleConfigured=${googleConfigured}`);

      res.json({
        status: "ok",
        writable,
        supabaseConfigured,
        googleConfigured,
        configured: googleConfigured, // Checked by frontend DataValidationModule
        timestamp: new Date().toISOString()
      });
    });

    app.get("/api/logs", (req, res) => {
      logToFile("[API] Serving /api/logs");
      try {
        if (fs.existsSync(LOG_FILE)) {
          res.type('text/plain').send(fs.readFileSync(LOG_FILE, 'utf-8'));
        } else {
          res.send("No logs found.");
        }
      } catch (e) {
        res.status(500).send("Error reading logs");
      }
    });

    logToFile("[Server] Registering data routes...");
    app.get("/api/agreements", async (req, res) => {
    try {
      const agreements = await readJsonArrayFile(AGREEMENTS_FILE);
      res.json(agreements);
    } catch (error) {
      logToFile(`Error reading agreements: ${error}`);
      res.status(500).json({ error: "Failed to read agreements" });
    }
  });

  app.post("/api/agreements", async (req, res) => {
    try {
      logToFile(`Attempting to save agreement: ${req.body?.id}`);
      if (!req.body || !req.body.id) {
        logToFile("Error: Missing agreement ID in request body");
        return res.status(400).json({ error: "Missing agreement ID" });
      }

      let agreements = await readJsonArrayFile(AGREEMENTS_FILE);

      const newAgreement = req.body;
      const index = agreements.findIndex((a: any) => a.id === newAgreement.id);
      if (index !== -1) {
        logToFile(`Updating existing agreement: ${newAgreement.id}`);
        agreements[index] = newAgreement;
      } else {
        logToFile(`Adding new agreement: ${newAgreement.id}`);
        agreements.push(newAgreement);
      }

      await fs.promises.writeFile(AGREEMENTS_FILE, JSON.stringify(agreements, null, 2));
      logToFile(`Successfully saved agreement: ${newAgreement.id}`);
      res.json({ success: true });
    } catch (error: any) {
      logToFile(`CRITICAL Error saving agreement: ${error.message}\nStack: ${error.stack}`);
      res.status(500).json({ error: "Failed to save agreement", details: error.message });
    }
  });

  const handleUpdate = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      logToFile(`Attempting to update agreement: ${id}`);
      
      let agreements = await readJsonArrayFile(AGREEMENTS_FILE);

      const index = agreements.findIndex((a: any) => a.id === id);
      if (index !== -1) {
        agreements[index] = { ...agreements[index], ...req.body };
        await fs.promises.writeFile(AGREEMENTS_FILE, JSON.stringify(agreements, null, 2));
        logToFile(`Successfully updated agreement: ${id}`);
        res.json({ success: true });
      } else {
        logToFile(`Error: Agreement not found for update: ${id}`);
        res.status(404).json({ error: "Not found" });
      }
    } catch (error: any) {
      logToFile(`CRITICAL Error updating agreement: ${error.message}`);
      res.status(500).json({ error: "Failed to update agreement", details: error.message });
    }
  };

  app.post("/api/agreements/sync", async (req, res) => {
    try {
      const incomingAgreements = req.body;
      logToFile(`Sync request received with ${incomingAgreements?.length} agreements`);
      
      if (!Array.isArray(incomingAgreements)) {
        logToFile("Error: Sync request body is not an array");
        return res.status(400).json({ error: "Invalid data format, expected array" });
      }

      let existingAgreements = await readJsonArrayFile(AGREEMENTS_FILE);

      let updatedCount = 0;
      incomingAgreements.forEach(incoming => {
        if (!incoming.id) return;
        const index = existingAgreements.findIndex((a: any) => a.id === incoming.id);
        if (index !== -1) {
          existingAgreements[index] = { ...existingAgreements[index], ...incoming };
        } else {
          existingAgreements.push(incoming);
        }
        updatedCount++;
      });

      await fs.promises.writeFile(AGREEMENTS_FILE, JSON.stringify(existingAgreements, null, 2));
      logToFile(`Successfully synced ${updatedCount} agreements`);
      res.json({ success: true, synced: updatedCount });
    } catch (error: any) {
      logToFile(`CRITICAL Error syncing agreements: ${error.message}\nStack: ${error.stack}`);
      res.status(500).json({ error: "Failed to sync agreements", details: error.message });
    }
  });

    app.patch("/api/agreements/:id", handleUpdate);
    app.post("/api/agreements/:id", handleUpdate);
    app.delete("/api/agreements/:id", async (req, res) => {
    try {
      const agreements = await readJsonArrayFile(AGREEMENTS_FILE);
      const { id } = req.params;
      const filtered = agreements.filter((a: any) => a.id !== id);
      await fs.promises.writeFile(AGREEMENTS_FILE, JSON.stringify(filtered, null, 2));
      logToFile(`Deleted agreement: ${id}`);
      res.json({ success: true });
    } catch (error) {
      logToFile(`Error deleting agreement ${req.params.id}: ${error}`);
      res.status(500).json({ error: "Failed to delete agreement" });
    }
  });

    logToFile("[Server] Registering closures routes...");
    app.get("/api/closures", async (req, res) => {
      try {
        const closures = await readJsonArrayFile(CLOSURES_FILE);
        res.json(closures);
      } catch (error) {
        logToFile(`Error reading closures: ${error}`);
        res.status(500).json({ error: "Failed to read closures" });
      }
    });

    app.post("/api/closures", async (req, res) => {
      try {
        logToFile(`Attempting to save closure: ${req.body?.id}`);
        if (!req.body || !req.body.id) {
          logToFile("Error: Missing closure ID in request body");
          return res.status(400).json({ error: "Missing closure ID" });
        }

        let closures = await readJsonArrayFile(CLOSURES_FILE);

        const newClosure = req.body;
        const index = closures.findIndex((c: any) => c.id === newClosure.id);
        if (index !== -1) {
          logToFile(`Updating existing closure: ${newClosure.id}`);
          closures[index] = newClosure;
        } else {
          logToFile(`Adding new closure: ${newClosure.id}`);
          closures.push(newClosure);
        }

        await fs.promises.writeFile(CLOSURES_FILE, JSON.stringify(closures, null, 2));
        logToFile(`Successfully saved closure: ${newClosure.id}`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving closure: ${error.message}\nStack: ${error.stack}`);
        res.status(500).json({ error: "Failed to save closure", details: error.message });
      }
    });

    app.patch("/api/closures/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to update closure: ${id}`);
        
        let closures = await readJsonArrayFile(CLOSURES_FILE);

        const index = closures.findIndex((c: any) => c.id === id);
        if (index !== -1) {
          closures[index] = { ...closures[index], ...req.body };
          await fs.promises.writeFile(CLOSURES_FILE, JSON.stringify(closures, null, 2));
          logToFile(`Successfully updated closure: ${id}`);
          res.json({ success: true });
        } else {
          logToFile(`Error: Closure not found for update: ${id}`);
          res.status(404).json({ error: "Not found" });
        }
      } catch (error: any) {
        logToFile(`CRITICAL Error updating closure: ${error.message}`);
        res.status(500).json({ error: "Failed to update closure", details: error.message });
      }
    });

    app.delete("/api/closures/:id", async (req, res) => {
      try {
        const closures = await readJsonArrayFile(CLOSURES_FILE);
        const { id } = req.params;
        const filtered = closures.filter((c: any) => c.id !== id);
        await fs.promises.writeFile(CLOSURES_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Deleted closure: ${id}`);
        res.json({ success: true });
      } catch (error) {
        logToFile(`Error deleting closure ${req.params.id}: ${error}`);
        res.status(500).json({ error: "Failed to delete closure" });
      }
    });

    logToFile("[Server] Registering complaints routes...");
    app.get("/api/complaints", async (req, res) => {
      try {
        const complaints = await readJsonArrayFile(COMPLAINTS_FILE);
        res.json(complaints);
      } catch (error) {
        logToFile(`Error reading complaints: ${error}`);
        res.status(500).json({ error: "Failed to read complaints" });
      }
    });

    app.post("/api/complaints", async (req, res) => {
      try {
        logToFile(`Attempting to save complaint: ${req.body?.id}`);
        if (!req.body || !req.body.id) {
          logToFile("Error: Missing complaint ID in request body");
          return res.status(400).json({ error: "Missing complaint ID" });
        }

        let complaints = await readJsonArrayFile(COMPLAINTS_FILE);

        const newComplaint = req.body;
        const index = complaints.findIndex((c: any) => c.id === newComplaint.id);
        if (index !== -1) {
          logToFile(`Updating existing complaint: ${newComplaint.id}`);
          complaints[index] = newComplaint;
        } else {
          logToFile(`Adding new complaint: ${newComplaint.id}`);
          complaints.push(newComplaint);
        }

        await fs.promises.writeFile(COMPLAINTS_FILE, JSON.stringify(complaints, null, 2));
        logToFile(`Successfully saved complaint: ${newComplaint.id}`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving complaint: ${error.message}`);
        res.status(500).json({ error: "Failed to save complaint", details: error.message });
      }
    });

    app.patch("/api/complaints/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to update complaint: ${id}`);
        
        let complaints = await readJsonArrayFile(COMPLAINTS_FILE);

        const index = complaints.findIndex((c: any) => c.id === id);
        if (index !== -1) {
          complaints[index] = { ...complaints[index], ...req.body };
          await fs.promises.writeFile(COMPLAINTS_FILE, JSON.stringify(complaints, null, 2));
          logToFile(`Successfully updated complaint: ${id}`);
          res.json({ success: true });
        } else {
          logToFile(`Error: Complaint not found for update: ${id}`);
          res.status(404).json({ error: "Not found" });
        }
      } catch (error: any) {
        logToFile(`CRITICAL Error updating complaint: ${error.message}`);
        res.status(500).json({ error: "Failed to update complaint", details: error.message });
      }
    });

    app.delete("/api/complaints/:id", async (req, res) => {
      try {
        const complaints = await readJsonArrayFile(COMPLAINTS_FILE);
        const { id } = req.params;
        const filtered = complaints.filter((c: any) => c.id !== id);
        await fs.promises.writeFile(COMPLAINTS_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Deleted complaint: ${id}`);
        res.json({ success: true });
      } catch (error) {
        logToFile(`Error deleting complaint ${req.params.id}: ${error}`);
        res.status(500).json({ error: "Failed to delete complaint" });
      }
    });

    logToFile("[Server] Registering inquiries routes...");
    app.get("/api/inquiries", async (req, res) => {
      try {
        const inquiries = await readJsonArrayFile(INQUIRIES_FILE);
        res.json(inquiries);
      } catch (error) {
        logToFile(`Error reading inquiries: ${error}`);
        res.status(500).json({ error: "Failed to read inquiries" });
      }
    });

    app.post("/api/inquiries", async (req, res) => {
      try {
        logToFile(`Attempting to save inquiry: ${req.body?.id}`);
        if (!req.body || !req.body.id) {
          logToFile("Error: Missing inquiry ID in request body");
          return res.status(400).json({ error: "Missing inquiry ID" });
        }

        let inquiries = await readJsonArrayFile(INQUIRIES_FILE);

        const newInquiry = req.body;
        const index = inquiries.findIndex((c: any) => c.id === newInquiry.id);
        if (index !== -1) {
          logToFile(`Updating existing inquiry: ${newInquiry.id}`);
          inquiries[index] = newInquiry;
        } else {
          logToFile(`Adding new inquiry: ${newInquiry.id}`);
          inquiries.push(newInquiry);
        }

        await fs.promises.writeFile(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));
        logToFile(`Successfully saved inquiry: ${newInquiry.id}`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving inquiry: ${error.message}`);
        res.status(500).json({ error: "Failed to save inquiry", details: error.message });
      }
    });

    app.patch("/api/inquiries/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to update inquiry: ${id}`);
        
        let inquiries = await readJsonArrayFile(INQUIRIES_FILE);

        const index = inquiries.findIndex((c: any) => c.id === id);
        if (index !== -1) {
          inquiries[index] = { ...inquiries[index], ...req.body };
          await fs.promises.writeFile(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2));
          logToFile(`Successfully updated inquiry: ${id}`);
          res.json({ success: true });
        } else {
          logToFile(`Error: Inquiry not found for update: ${id}`);
          res.status(404).json({ error: "Not found" });
        }
      } catch (error: any) {
        logToFile(`CRITICAL Error updating inquiry: ${error.message}`);
        res.status(500).json({ error: "Failed to update inquiry", details: error.message });
      }
    });

    app.delete("/api/inquiries/:id", async (req, res) => {
      try {
        const inquiries = await readJsonArrayFile(INQUIRIES_FILE);
        const { id } = req.params;
        const filtered = inquiries.filter((c: any) => c.id !== id);
        await fs.promises.writeFile(INQUIRIES_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Deleted inquiry: ${id}`);
        res.json({ success: true });
      } catch (error) {
        logToFile(`Error deleting inquiry ${req.params.id}: ${error}`);
        res.status(500).json({ error: "Failed to delete inquiry" });
      }
    });

    logToFile("[Server] Registering debtors routes...");
    app.get("/api/debtors", async (req, res) => {
    try {
      const debtors = await readJsonArrayFile(DEBTORS_FILE);
      res.json(debtors);
    } catch (error) {
      res.status(500).json({ error: "Failed to read debtors" });
    }
  });

    app.post("/api/debtors", async (req, res) => {
    try {
      logToFile(`Attempting to save ${req.body?.length} debtors`);
      const debtorsToSave = Array.isArray(req.body) ? req.body : [];
      await fs.promises.writeFile(DEBTORS_FILE, JSON.stringify(debtorsToSave, null, 2));
      logToFile(`Successfully saved debtors`);
      res.json({ success: true });
    } catch (error: any) {
      logToFile(`CRITICAL Error saving debtors: ${error.message}`);
      res.status(500).json({ error: "Failed to save debtors", details: error.message });
    }
  });

    logToFile("[Server] Registering clients routes...");
    app.get("/api/clients", async (req, res) => {
      try {
        const clients = await readJsonArrayFile(CLIENTS_FILE);
        res.json(clients);
      } catch (error) {
        logToFile(`Error reading clients: ${error}`);
        res.status(500).json({ error: "Failed to read clients" });
      }
    });

    app.post("/api/clients", async (req, res) => {
      try {
        logToFile(`Attempting to save client/clients`);
        if (!req.body) {
          return res.status(400).json({ error: "Missing request body" });
        }

        let clients = await readJsonArrayFile(CLIENTS_FILE);
        const cleanPermit = (s: any) => (String(s || '')).toLowerCase().replace(/kdb|lc/g, '').replace(/[^a-z0-9]/g, '');
        const cleanStr = (s: any) => (String(s || '')).toLowerCase().trim().replace(/[^a-z0-9]/g, '');

        if (Array.isArray(req.body)) {
          // Deduplicate array and ensure closed clients are DNQ-R
          const seen = new Set<string>();
          const deduped: any[] = [];
          for (const item of req.body) {
            if (item.operationalStatus === 'closed') {
              item.levyInfo = 'DNQ-R';
            }
            const pKey = cleanPermit(item.permitNumber || item.id) || cleanStr(item.clientName);
            if (!pKey || !seen.has(pKey)) {
              if (pKey) seen.add(pKey);
              deduped.push(item);
            }
          }
          clients = deduped;
        } else {
          const newClient = req.body;
          if (newClient.operationalStatus === 'closed') {
            newClient.levyInfo = 'DNQ-R';
          }
          const pNew = cleanPermit(newClient.permitNumber || newClient.id);
          const cNew = cleanStr(newClient.clientName);
          const premNew = cleanStr(newClient.premiseName);
          const recId = String(newClient.id || '').trim();

          const index = clients.findIndex((c: any) => {
            const cId = String(c.id || '').trim();
            if (recId && cId && recId === cId) return true;
            const cPermit = cleanPermit(c.permitNumber || c.id);
            if (pNew && cPermit && (pNew === cPermit || pNew.includes(cPermit) || cPermit.includes(pNew))) return true;
            const cName = cleanStr(c.clientName);
            const cPrem = cleanStr(c.premiseName);
            if (cNew && cName && cNew === cName && premNew && cPrem && premNew === cPrem) return true;
            if (cNew && cName && cNew === cName) return true;
            return false;
          });

          if (index !== -1) {
            const preservedId = clients[index].id || newClient.id;
            logToFile(`Updating existing client in-place: ${preservedId}`);
            clients[index] = { ...clients[index], ...newClient, id: preservedId };
            
            // Remove any other duplicate entries
            clients = clients.filter((c: any, i: number) => {
              if (i === index) return true;
              const otherId = String(c.id || '').trim();
              const otherPermit = cleanPermit(c.permitNumber || c.id);
              if (preservedId && otherId && preservedId === otherId) return false;
              if (pNew && otherPermit && pNew === otherPermit) return false;
              return true;
            });
          } else {
            logToFile(`Adding new client: ${newClient.id}`);
            clients.push(newClient);
          }
        }

        await fs.promises.writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2));
        logToFile(`Successfully saved clients`);
        res.json({ success: true, clients });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving clients: ${error.message}`);
        res.status(500).json({ error: "Failed to save clients", details: error.message });
      }
    });

    app.delete("/api/clients/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to delete client: ${id}`);
        
        const clients = await readJsonArrayFile(CLIENTS_FILE);
        const filtered = clients.filter((c: any) => c.id !== id);
        
        await fs.promises.writeFile(CLIENTS_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Successfully deleted client: ${id}`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error deleting client: ${error.message}`);
        res.status(500).json({ error: "Failed to delete client", details: error.message });
      }
    });

    logToFile("[Server] Registering returns routes...");
    app.get("/api/returns", async (req, res) => {
      try {
        const returnsList = await readJsonArrayFile(RETURNS_FILE);
        res.json(returnsList);
      } catch (error) {
        logToFile(`Error reading returns: ${error}`);
        res.status(500).json({ error: "Failed to read returns" });
      }
    });

    app.post("/api/returns", async (req, res) => {
      try {
        logToFile(`Attempting to save return(s)`);
        if (!req.body) {
          return res.status(400).json({ error: "Missing request body" });
        }

        let returnsList = await readJsonArrayFile(RETURNS_FILE);

        if (Array.isArray(req.body)) {
          returnsList = req.body;
        } else {
          const newReturn = req.body;
          if (!newReturn.id) {
            return res.status(400).json({ error: "Missing return ID" });
          }
          const index = returnsList.findIndex((r: any) => r.id === newReturn.id);
          if (index !== -1) {
            logToFile(`Updating existing return: ${newReturn.id}`);
            returnsList[index] = newReturn;
          } else {
            logToFile(`Adding new return: ${newReturn.id}`);
            returnsList.push(newReturn);
          }
        }

        await fs.promises.writeFile(RETURNS_FILE, JSON.stringify(returnsList, null, 2));
        logToFile(`Successfully saved returns`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving returns: ${error.message}`);
        res.status(500).json({ error: "Failed to save returns", details: error.message });
      }
    });

    app.delete("/api/returns/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to delete return: ${id}`);
        
        const returnsList = await readJsonArrayFile(RETURNS_FILE);
        const filtered = returnsList.filter((r: any) => r.id !== id);
        
        await fs.promises.writeFile(RETURNS_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Successfully deleted return: ${id}`);
        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error deleting return: ${error.message}`);
        res.status(500).json({ error: "Failed to delete return", details: error.message });
      }
    });

    logToFile("[Server] Registering validations routes...");
    app.get("/api/validations", async (req, res) => {
      try {
        const validationsList = await readJsonArrayFile(VALIDATIONS_FILE);
        res.json(validationsList);
      } catch (error) {
        logToFile(`Error reading validations: ${error}`);
        res.status(500).json({ error: "Failed to read validations" });
      }
    });

    app.post("/api/validations", async (req, res) => {
      try {
        logToFile(`Attempting to save validation(s)`);
        if (!req.body) {
          return res.status(400).json({ error: "Missing request body" });
        }

        let validationsList = await readJsonArrayFile(VALIDATIONS_FILE);

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const ensureUuid = (id?: string) => {
          if (id && UUID_REGEX.test(id)) return id;
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        };

        const formatSupabaseRow = (v: any) => {
          const nowIso = new Date().toISOString();
          const uuid = ensureUuid(v.id || v.raw_data?.uuid || v.rawData?.uuid);
          let valPeriod = v.period || v.validationPeriod || v.validation_period || '';
          const yearVal = v.year || (v.date ? new Date(v.date).getFullYear() : null);
          if (valPeriod && yearVal && !valPeriod.includes(String(yearVal))) {
            valPeriod = `${valPeriod} ${yearVal}`;
          }
          const rawData = v.rawData || v.raw_data || { ...v };
          rawData.uuid = uuid;
          if (!rawData.timestamp) rawData.timestamp = nowIso;
          if (!rawData.created_at) rawData.created_at = nowIso;
          if (!rawData.createdAt) rawData.createdAt = nowIso;
          if (!rawData.submitted_at) rawData.submitted_at = nowIso;
          if (!rawData.submittedAt) rawData.submittedAt = nowIso;
          if (!rawData.validated_at) rawData.validated_at = v.validatedAt || nowIso;
          if (!rawData.validatedAt) rawData.validatedAt = v.validatedAt || nowIso;

          return {
            id: uuid,
            dbo_name: v.clientName || v.dboName || v.dbo_name || '',
            premise_name: v.premiseName || v.premise_name || '',
            branch: v.branch || rawData.branch || 'Kericho',
            date: v.validatedAt || v.date || nowIso.split('T')[0],
            created_at: nowIso,
            submitted_at: nowIso,
            timestamp: nowIso,
            updated_at: nowIso,
            validation_period: valPeriod,
            category: v.category || rawData.category || '',
            permit_no: v.permitNo || v.permit_no || '',
            location: v.location || rawData.location || '',
            county: v.county || rawData.county || 'Kericho',
            total_penalty: Number(v.totalPenalty || v.total_penalty || rawData.totalPenalty) || 0,
            raw_data: rawData,
            pdf_path: v.pdfPath || v.pdf_path || rawData.pdfPath || null
          };
        };

        const itemsToSync: any[] = [];

        if (Array.isArray(req.body)) {
          validationsList = req.body;
          req.body.forEach(item => itemsToSync.push(formatSupabaseRow(item)));
        } else {
          const newValidation = req.body;
          if (!newValidation.id) {
            newValidation.id = ensureUuid();
          }
          const index = validationsList.findIndex((v: any) => v.id === newValidation.id);
          if (index !== -1) {
            logToFile(`Updating existing validation: ${newValidation.id}`);
            validationsList[index] = newValidation;
          } else {
            logToFile(`Adding new validation: ${newValidation.id}`);
            validationsList.push(newValidation);
          }
          itemsToSync.push(formatSupabaseRow(newValidation));
        }

        await fs.promises.writeFile(VALIDATIONS_FILE, JSON.stringify(validationsList, null, 2));
        logToFile(`Successfully saved validations locally`);

        // Asynchronously sync to Supabase if configured
        if (sUrl && sKey && itemsToSync.length > 0) {
          (async () => {
            try {
              const serverSupabase = createClient(sUrl, sKey);
              const safeServerUpsert = async (tableName: string) => {
                let payload = itemsToSync.map(item => ({ ...item }));
                for (let attempt = 0; attempt < 6; attempt++) {
                  const { error } = await serverSupabase.from(tableName).upsert(payload);
                  if (!error) {
                    logToFile(`[Server] Synced ${payload.length} validation(s) to ${tableName} with timestamps`);
                    return;
                  }
                  const errMsg = error.message || '';
                  const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                                || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                                || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
                  if (matchCol && matchCol[1]) {
                    const col = matchCol[1];
                    logToFile(`[Server] Column "${col}" not present in ${tableName}, retrying without it...`);
                    payload.forEach(it => { delete it[col]; });
                    continue;
                  }
                  logToFile(`[Server] Warning: Supabase ${tableName} upsert failed: ${error.message}`);
                  break;
                }
              };

              await Promise.allSettled([
                safeServerUpsert('kdb_validations'),
                safeServerUpsert('data_validations')
              ]);
            } catch (sbErr: any) {
              logToFile(`[Server] Warning: Background Supabase validation sync exception: ${sbErr.message}`);
            }
          })();
        }

        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving validations: ${error.message}`);
        res.status(500).json({ error: "Failed to save validations", details: error.message });
      }
    });

    app.delete("/api/validations/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`Attempting to delete validation: ${id}`);
        
        const validationsList = await readJsonArrayFile(VALIDATIONS_FILE);
        const filtered = validationsList.filter((v: any) => v.id !== id);
        
        await fs.promises.writeFile(VALIDATIONS_FILE, JSON.stringify(filtered, null, 2));
        logToFile(`Successfully deleted validation ${id}`);

        if (sUrl && sKey) {
          (async () => {
            try {
              const serverSupabase = createClient(sUrl, sKey);
              const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
              if (UUID_REGEX.test(id)) {
                await Promise.allSettled([
                  serverSupabase.from('data_validations').delete().eq('id', id),
                  serverSupabase.from('kdb_validations').delete().eq('id', id)
                ]);
              } else {
                await Promise.allSettled([
                  serverSupabase.from('data_validations').delete().or(`permit_no.eq.${id},premise_name.eq.${id}`),
                  serverSupabase.from('kdb_validations').delete().or(`permit_no.eq.${id},premise_name.eq.${id}`)
                ]);
              }
            } catch (sbErr) {
              logToFile(`[Server] Supabase delete validation warning: ${sbErr}`);
            }
          })();
        }

        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error deleting validation: ${error.message}`);
        res.status(500).json({ error: "Failed to delete validation", details: error.message });
      }
    });

    logToFile("[Server] Registering validation drafts routes...");
    app.get("/api/validation-drafts", async (req, res) => {
      try {
        const draftsList = await readJsonArrayFile(VALIDATION_DRAFTS_FILE);
        res.json(draftsList);
      } catch (error: any) {
        logToFile(`Error reading validation drafts: ${error.message}`);
        res.status(500).json({ error: "Failed to read drafts" });
      }
    });

    app.post("/api/validation-drafts", async (req, res) => {
      try {
        if (!req.body) {
          return res.status(400).json({ error: "Missing request body" });
        }
        const draft = req.body;
        const nowIso = new Date().toISOString();
        if (!draft.id) {
          draft.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        }
        draft.updated_at = nowIso;
        if (!draft.created_at) draft.created_at = nowIso;

        let draftsList = await readJsonArrayFile(VALIDATION_DRAFTS_FILE);
        const idx = draftsList.findIndex((d: any) => d.id === draft.id);
        if (idx > -1) {
          draftsList[idx] = draft;
        } else {
          draftsList.unshift(draft);
        }

        await fs.promises.writeFile(VALIDATION_DRAFTS_FILE, JSON.stringify(draftsList, null, 2));
        logToFile(`[Server] Saved draft locally: ${draft.id}`);

        if (sUrl && sKey) {
          (async () => {
            try {
              const serverSupabase = createClient(sUrl, sKey);
              const supabaseRow: any = {
                id: draft.id,
                permit_no: draft.permit_no || draft.permitNo || '',
                dbo_name: draft.dbo_name || draft.dboName || '',
                premise_name: draft.premise_name || draft.premiseName || '',
                validation_period: draft.validation_period || draft.validationPeriod || '',
                category: draft.category || '',
                location: draft.location || '',
                county: draft.county || 'Kericho',
                branch: draft.branch || 'Kericho',
                step: draft.step ?? 0,
                status: 'draft',
                raw_data: draft.raw_data || draft.rawData || draft,
                created_at: draft.created_at,
                updated_at: draft.updated_at
              };

              for (let attempt = 0; attempt < 5; attempt++) {
                const { error } = await serverSupabase.from('validation_drafts').upsert([supabaseRow]);
                if (!error) {
                  logToFile(`[Server] Synced draft ${draft.id} to Supabase validation_drafts`);
                  break;
                }
                const errMsg = error.message || '';
                const matchCol = errMsg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation/i) 
                              || errMsg.match(/Could not find the '?([a-zA-Z0-9_]+)'? column/i)
                              || errMsg.match(/column "?([a-zA-Z0-9_]+)"? does not exist/i);
                if (matchCol && matchCol[1] && supabaseRow.hasOwnProperty(matchCol[1])) {
                  delete supabaseRow[matchCol[1]];
                  continue;
                }
                logToFile(`[Server] Warning: Supabase validation_drafts upsert failed: ${error.message}`);
                break;
              }
            } catch (sbErr: any) {
              logToFile(`[Server] Supabase draft sync exception: ${sbErr.message}`);
            }
          })();
        }

        res.json({ success: true, draft });
      } catch (error: any) {
        logToFile(`CRITICAL Error saving draft: ${error.message}`);
        res.status(500).json({ error: "Failed to save draft", details: error.message });
      }
    });

    app.delete("/api/validation-drafts/:id", async (req, res) => {
      try {
        const { id } = req.params;
        logToFile(`[Server] Attempting to delete draft: ${id}`);
        const draftsList = await readJsonArrayFile(VALIDATION_DRAFTS_FILE);
        const filtered = draftsList.filter((d: any) => d.id !== id);
        await fs.promises.writeFile(VALIDATION_DRAFTS_FILE, JSON.stringify(filtered, null, 2));

        if (sUrl && sKey) {
          (async () => {
            try {
              const serverSupabase = createClient(sUrl, sKey);
              await serverSupabase.from('validation_drafts').delete().eq('id', id);
              logToFile(`[Server] Deleted draft ${id} from Supabase validation_drafts`);
            } catch (sbErr: any) {
              logToFile(`[Server] Supabase delete draft warning: ${sbErr.message}`);
            }
          })();
        }

        res.json({ success: true });
      } catch (error: any) {
        logToFile(`CRITICAL Error deleting draft: ${error.message}`);
        res.status(500).json({ error: "Failed to delete draft", details: error.message });
      }
    });

    logToFile("[Server] Registering staff routes...");
    app.get("/api/staff", async (req, res) => {
    try {
      if (!fs.existsSync(STAFF_FILE)) {
        return res.json({ officialSignature: '' });
      }
      const data = await fs.promises.readFile(STAFF_FILE, "utf-8");
      try {
        res.json(JSON.parse(data));
      } catch (parseError) {
        logToFile(`Error parsing staff JSON: ${parseError}`);
        res.json({ officialSignature: '' });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to read staff config" });
    }
  });

    app.post("/api/staff", async (req, res) => {
    try {
      logToFile(`Attempting to save staff config`);
      await fs.promises.writeFile(STAFF_FILE, JSON.stringify(req.body, null, 2));
      logToFile(`Successfully saved staff config`);
      res.json({ success: true });
    } catch (error: any) {
      logToFile(`CRITICAL Error saving staff config: ${error.message}`);
      res.status(500).json({ error: "Failed to save staff config", details: error.message });
    }
  });

  // Service Account Auth Helper for Google Sheets
  const getSheetsClient = () => {
    let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error("Service Account credentials (EMAIL/PRIVATE_KEY) are missing.");
    }

    clientEmail = clientEmail.trim().replace(/^["']|["']$/g, '');

    // Clean the private key:
    // 1. Remove any surrounding quotes that might have been pasted accidentally
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    // 2. Convert literal \n strings into actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      throw new Error("Invalid Private Key format. It must start with '-----BEGIN PRIVATE KEY-----'. Check your environment variables.");
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: "v4", auth });
  };

  const formatSellingPriceForSheets = (sellingPriceInput: any): string => {
    if (sellingPriceInput === undefined || sellingPriceInput === null) return "";
    
    let priceList: string[] = [];

    // Helper to extract clean numeric price value from a string (e.g. "Raw Milk: 53", "53", "Raw Milk: Kshs 53")
    const cleanSinglePrice = (val: any): string => {
      if (val === undefined || val === null) return "";
      let str = String(val).trim();
      if (!str) return "";
      
      // If string contains "Product: Price", extract the portion after the colon
      if (str.includes(':')) {
        str = str.substring(str.lastIndexOf(':') + 1).trim();
      }
      // Strip common currency prefixes and suffixes
      str = str.replace(/^(?:kshs?\.?|kes\.?)\s*/i, '').replace(/\s*(?:\/=|per\s+.*)$/i, '').trim();
      return str;
    };

    if (typeof sellingPriceInput === 'number') {
      return String(sellingPriceInput);
    }

    if (Array.isArray(sellingPriceInput)) {
      priceList = sellingPriceInput
        .map(cleanSinglePrice)
        .filter(p => p !== '');
      return priceList.join(' | ');
    }

    if (typeof sellingPriceInput === 'object') {
      priceList = Object.values(sellingPriceInput)
        .map(cleanSinglePrice)
        .filter(p => p !== '');
      return priceList.join(' | ');
    }

    const sellingPriceStr = String(sellingPriceInput).trim();
    if (!sellingPriceStr) return "";

    // Check if string is a JSON object or array
    if ((sellingPriceStr.startsWith('{') && sellingPriceStr.endsWith('}')) || 
        (sellingPriceStr.startsWith('[') && sellingPriceStr.endsWith(']'))) {
      try {
        const parsed = JSON.parse(sellingPriceStr);
        if (Array.isArray(parsed)) {
          priceList = parsed.map(cleanSinglePrice).filter(p => p !== '');
          if (priceList.length > 0) return priceList.join(' | ');
        } else if (typeof parsed === 'object' && parsed !== null) {
          priceList = Object.values(parsed).map(cleanSinglePrice).filter(p => p !== '');
          if (priceList.length > 0) return priceList.join(' | ');
        }
      } catch {
        // Not JSON, continue with string splitting
      }
    }

    // Handle strings like "Raw Milk: 53 | Mala: 60" or "Raw Milk: 53, Mala: 60"
    const delimiter = sellingPriceStr.includes('|') ? '|' : (sellingPriceStr.includes(';') ? ';' : ',');
    const parts = sellingPriceStr.split(delimiter);

    parts.forEach(part => {
      const cleaned = cleanSinglePrice(part);
      if (cleaned) {
        priceList.push(cleaned);
      }
    });

    if (priceList.length > 0) {
      return priceList.join(' | ');
    }

    return cleanSinglePrice(sellingPriceStr);
  };

  app.post("/api/submit", async (req, res) => {
    logToFile("[API] Received /api/submit request for detailed Google Sheets sync");
    const { data } = req.body;
    
    if (!data) {
      logToFile("[API] Submit failed: Missing 'data' object in request body");
      return res.status(400).json({ error: "Missing 'data' object" });
    }

    let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || req.body.spreadsheetId;
    if (!spreadsheetId) {
      logToFile("[API] Google Sheets sync skipped: GOOGLE_SPREADSHEET_ID not configured");
      return res.status(200).json({ message: "Supabase saved. Google Sheets sync skipped (ID not configured)." });
    }
    spreadsheetId = spreadsheetId.trim().replace(/^["']|["']$/g, '');

    try {
      const sheets = getSheetsClient();

      // Mapping logic
      const allRows: { sheet: string, rows: any[][] }[] = [];

      const isBranch = Boolean(
        data.isBranchFacility ||
        (data.validationPremiseMode && data.validationPremiseMode !== 'main') ||
        data.isBranch
      );

      if (data.category === 'Mini Dairy' || data.category === 'Cottage Industry' || data.category === 'Milk Bar' || data.category === 'Dispenser') {
        const sheet = (data.category === 'Mini Dairy' || data.category === 'Cottage Industry') 
          ? "MD & CI - Distribution" 
          : "Dispensers & Milk Bars";
          
        const isMiniOrCottage = data.category === 'Mini Dairy' || data.category === 'Cottage Industry';
        
        let distNameFormatted = "";
        let distContactsFormatted = "";
        let distVolPerDayFormatted = "";
        let distPermitNoFormatted = "";
        let distAreaOfSaleFormatted = "";
        let distOutletsFormatted = "";
        let distNatureOfProduceFormatted = "";
        let distPriceFormatted = "";

        if (isMiniOrCottage) {
          const distributors = Array.isArray(data.distributors) && data.distributors.length > 0
            ? data.distributors
            : [{
                name: data.distName,
                contacts: data.distContacts,
                volPerDay: data.distVolPerDay,
                permitNo: data.distPermitNo,
                areaOfSale: data.distAreaOfSale,
                outlets: data.distOutlets || [],
                natureOfProduce: data.distNatureOfProduce || [],
                prices: { [data.distNatureOfProduce?.[0] || 'Produce']: data.distPrice }
              }];

          distNameFormatted = distributors.map((d: any) => d.name || "").join(' | ');
          distContactsFormatted = distributors.map((d: any) => d.contacts || "").join(' | ');
          distVolPerDayFormatted = distributors.map((d: any) => d.volPerDay || "").join(' | ');
          distPermitNoFormatted = distributors.map((d: any) => d.permitNo || "").join(' | ');
          distAreaOfSaleFormatted = distributors.map((d: any) => d.areaOfSale || "").join(' | ');
          
          distOutletsFormatted = distributors.map((d: any, dIdx: number) => {
            const outletsStr = Array.isArray(d.outlets)
              ? d.outlets.map((o: any) => `${o.location} (Vol: ${o.volPerDay}, Permit: ${o.permitStatus}, Levy: ${o.levyInfo})`).join(', ')
              : "";
            return `Distributor #${dIdx + 1}: ${outletsStr}`;
          }).join(' | ');

          distNatureOfProduceFormatted = distributors.map((d: any, dIdx: number) => {
            const prodStr = Array.isArray(d.natureOfProduce) ? d.natureOfProduce.join(', ') : "";
            return `Distributor #${dIdx + 1}: ${prodStr}`;
          }).join(' | ');

          distPriceFormatted = distributors.map((d: any, dIdx: number) => {
            const priceStr = d.prices && Object.keys(d.prices).length > 0
              ? formatSellingPriceForSheets(d.prices)
              : formatSellingPriceForSheets(d.distPrice || '');
            return `Distributor #${dIdx + 1}: ${priceStr}`;
          }).join(' | ');
        }

        const rows = data.sales.map((sale: any) => [
          data.dboName, data.location, data.contacts, data.permitNo, data.expiryDate, 
          sale.avgVolPerDay || "", (isBranch ? "" : (sale.buyingPrice || "")), formatSellingPriceForSheets(sale.sellingPrice), data.traceability,
          `${sale.month} ${sale.year}`, (isBranch ? "" : (sale.qtyDeclared || "")), sale.verifiedQty || "", (isBranch ? "" : (sale.underDeclared || "")),
          data.date, data.startTime, data.endTime,
          Array.isArray(data.natureOfProduce) ? data.natureOfProduce.join(', ') : (data.natureOfProduce || ""),
          // Appended Option A Columns (for MD & CI - Distribution sheet)
          distNameFormatted,
          distContactsFormatted,
          distVolPerDayFormatted,
          distPermitNoFormatted,
          distAreaOfSaleFormatted,
          distOutletsFormatted,
          distNatureOfProduceFormatted,
          distPriceFormatted
        ]);
        allRows.push({ sheet, rows });
      } else if (data.category === 'CP<5,000 L/D' || data.category === 'CP>5,000 L/D' || data.category === 'Processor') {
        const sheet = "Cooling Plants";
        // Capture Intakes
        const intakeRows = data.intakes.map((intake: any) => [
          data.dboName, data.location, data.contacts, data.permitNo, data.expiryDate, 
          intake.avgVolPerDay || "", intake.farmerPrice || "", intake.processorPrice || "", data.traceability,
          `${intake.month} ${intake.year}`, intake.quantity, "TOTAL INTAKE", "", "",
          data.date, data.startTime, data.endTime,
          Array.isArray(data.natureOfProduce) ? data.natureOfProduce.join(', ') : (data.natureOfProduce || "")
        ]);
        allRows.push({ sheet, rows: intakeRows });
        
        // Capture Sales for Cooling Plants
        const salesRows = data.sales
          .filter((s: any) => s.verifiedQty || (!isBranch && s.qtyDeclared))
          .map((sale: any) => [
            data.dboName, data.location, data.contacts, data.permitNo, data.expiryDate, 
            sale.avgVolPerDay || "", (isBranch ? "" : (sale.buyingPrice || "")), formatSellingPriceForSheets(sale.sellingPrice), data.traceability,
            `${sale.month} ${sale.year}`, (isBranch ? "" : (sale.qtyDeclared || "")), "LOCAL SALES", sale.verifiedQty || "", (isBranch ? "" : (sale.underDeclared || "")),
            data.date, data.startTime, data.endTime,
            Array.isArray(data.natureOfProduce) ? data.natureOfProduce.join(', ') : (data.natureOfProduce || "")
          ]);
        if (salesRows.length > 0) {
          allRows.push({ sheet, rows: salesRows });
        }
      }

      for (const item of allRows) {
        if (item.rows.length > 0) {
          logToFile(`[API] Appending ${item.rows.length} rows to sheet "${item.sheet}"`);
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${item.sheet}!A:Z`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: item.rows },
          });
        }
      }

      logToFile("[API] Detailed Google Sheets sync completed successfully");
      res.json({ success: true });
    } catch (error: any) {
      logToFile(`[API] Google Sheets submit error: ${error.message}\nStack: ${error.stack}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/status", async (req, res) => {
    try {
      const agreementsData = await fs.promises.readFile(AGREEMENTS_FILE, "utf-8");
      const debtorsData = await fs.promises.readFile(DEBTORS_FILE, "utf-8");
      const agreements = JSON.parse(agreementsData);
      const debtors = JSON.parse(debtorsData);
      res.json({
        agreementsCount: agreements.length,
        debtorsCount: debtors.length,
        agreementsFile: AGREEMENTS_FILE,
        debtorsFile: DEBTORS_FILE,
        writable: true,
        dataDir: DATA_DIR
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/validations-timeline", async (req, res) => {
    logToFile("[API] Received /api/validations-timeline request");
    try {
      const sheets = getSheetsClient();
      const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

      let tab1Values: any[][] = [];
      let tab2Values: any[][] = [];
      let tab3Values: any[][] = [];

      if (sheets && spreadsheetId) {
        try {
          const [tab1Response, tab2Response, tab3Response] = await Promise.all([
            sheets.spreadsheets.values.get({ spreadsheetId, range: "'MD & CI Distribution'!A:Z" }),
            sheets.spreadsheets.values.get({ spreadsheetId, range: "'Dispensers & Milk Bars'!A:Z" }),
            sheets.spreadsheets.values.get({ spreadsheetId, range: "'Cooling Plants'!A:Z" }),
          ]);
          tab1Values = tab1Response.data.values || [];
          tab2Values = tab2Response.data.values || [];
          tab3Values = tab3Response.data.values || [];
        } catch (sheetsErr: any) {
          logToFile(`[API] Google Sheets timeline fetch note: ${sheetsErr.message}`);
        }
      }

      // Import validationAggregator helper
      const { processValidationsToTimeline } = await import("../utils/validationAggregator.js");
      const timeline = processValidationsToTimeline(tab1Values, tab2Values, tab3Values);

      res.json({ success: true, timeline });
    } catch (error: any) {
      logToFile(`[API] /api/validations-timeline error: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

    logToFile("[Server] API routes registered. Skipping catch-all for stability...");

    logToFile("[Server] Setting up SPA fallback...");
    // Catch-all for /api routes to prevent them from falling through to Vite's HTML fallback
    app.all("/api/*all", (req, res) => {
      logToFile(`[API] 404 Not Found: ${req.method} ${req.url}`);
      res.status(404).json({ error: "API route not found" });
    });

    // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    logToFile("[Server] Starting Vite in middleware mode...");
    try {
      const { createServer: createViteServer } = await import("vite");
      logToFile("[Server] Vite module imported.");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      logToFile("[Server] Vite middleware created successfully.");
      app.use(vite.middlewares);
    } catch (e: any) {
      logToFile(`[Server] ERROR creating Vite server: ${e.message}`);
      console.error("Failed to initialize Vite middleware:", e);
    }
  } else {
    console.log("[Server] Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    const status = err.status || err.statusCode || 500;
    logToFile(`UNHANDLED ERROR: ${err.message}\nStack: ${err.stack}`);
    res.status(status).json({
      error: "Internal Server Error",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  // Ensure data directory exists and initial files exist (if writable)
  try {
    if (!fs.existsSync(DATA_DIR)) {
      console.log(`[Server] Creating data directory: ${DATA_DIR}`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    [AGREEMENTS_FILE, CLOSURES_FILE, DEBTORS_FILE].forEach(file => {
      if (!fs.existsSync(file)) {
        console.log(`[Server] Initializing file: ${file}`);
        fs.writeFileSync(file, JSON.stringify([], null, 2));
      }
    });

    if (!fs.existsSync(CLIENTS_FILE)) {
      console.log(`[Server] Initializing clients file with default licensed clients...`);
      const initialClients = [
        {
          id: "LC-001",
          clientName: "Sunrise Dairies",
          premiseName: "Sunrise Main Plant",
          startYear: 2022,
          startMonth: "January",
          endYear: null,
          endMonth: null,
          tel: "0712345678",
          contactPerson: "John Doe",
          location: "Kericho Town, Court Road",
          premiseCategory: "Processor",
          county: "Kericho",
          coolingCapacity: 15000,
          permitStatus: "active",
          operationalStatus: "operating",
          levyInfo: "QFR"
        },
        {
          id: "LC-002",
          clientName: "Belgut Milk Bar",
          premiseName: "Belgut Outlet",
          startYear: 2022,
          startMonth: "June",
          endYear: 2024,
          endMonth: "December",
          tel: "0722334455",
          contactPerson: "Alice Koech",
          location: "Kapsoit, Belgut",
          premiseCategory: "Milk Bar",
          county: "Kericho",
          permitStatus: "inactive",
          operationalStatus: "closed",
          levyInfo: "DNQ-R"
        },
        {
          id: "LC-003",
          clientName: "Tea County Dispensers",
          premiseName: "Kenyagano Station",
          startYear: 2023,
          startMonth: "March",
          endYear: null,
          endMonth: null,
          tel: "0733445566",
          contactPerson: "David Langat",
          location: "Litein, Bureti",
          premiseCategory: "Dispenser",
          county: "Kericho",
          permitStatus: "active",
          operationalStatus: "operating",
          levyInfo: "QFR"
        },
        {
          id: "LC-004",
          clientName: "Kipkelion Cooling Association",
          premiseName: "Kipkelion Plant",
          startYear: 2022,
          startMonth: "August",
          endYear: null,
          endMonth: null,
          tel: "0744556677",
          contactPerson: "Grace Chepngetich",
          location: "Kipkelion Town",
          premiseCategory: "Cooling Plant",
          county: "Kericho",
          coolingCapacity: 8000,
          permitStatus: "active",
          operationalStatus: "operating",
          levyInfo: "QFR"
        },
        {
          id: "LC-005",
          clientName: "Sotik Border Cottage",
          premiseName: "Borderline Creamery",
          startYear: 2022,
          startMonth: "October",
          endYear: null,
          endMonth: null,
          tel: "0755667788",
          contactPerson: "Robert Sang",
          location: "Sotik Road, Sigowet",
          premiseCategory: "Cottage Industry",
          county: "Kericho",
          permitStatus: "active",
          operationalStatus: "operating",
          levyInfo: "DNQ-R"
        },
        {
          id: "LC-006",
          clientName: "Ainamoi Mini Dairy",
          premiseName: "Ainamoi Depot",
          startYear: 2022,
          startMonth: "February",
          endYear: null,
          endMonth: null,
          tel: "0766778899",
          contactPerson: "Sarah Cherono",
          location: "Ainamoi Junction",
          premiseCategory: "Mini Dairy",
          county: "Kericho",
          permitStatus: "active",
          operationalStatus: "operating",
          levyInfo: "DNQ-R"
        }
      ];
      fs.writeFileSync(CLIENTS_FILE, JSON.stringify(initialClients, null, 2));
    }

    if (!fs.existsSync(STAFF_FILE)) {
      console.log(`[Server] Initializing staff file: ${STAFF_FILE}`);
      fs.writeFileSync(STAFF_FILE, JSON.stringify({ officialSignature: '' }, null, 2));
    }
  } catch (e) {
    console.warn("Could not write initial json seed files (read-only filesystem or Supabase primary mode):", e);
  }

  console.log(`[Server] Attempting to listen on port ${PORT}...`);
  if (process.env.NODE_ENV !== "test") {
    logToFile("[Server] Attempting to start server on port " + PORT);
  const server = app.listen(PORT, "0.0.0.0", () => {
    logToFile(`[Server] SUCCESS: Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] SUCCESS: Running on http://0.0.0.0:${PORT}`);
  });
  server.on('error', (e: any) => {
    logToFile(`[Server] ERROR starting server: ${e.message}`);
    console.error(`[Server] ERROR starting server: ${e.message}`);
  });
  }

  return app;
  } catch (error: any) {
    console.error("[Server] CRITICAL STARTUP ERROR:", error);
    throw error;
  }
}

export const appPromise = startServer();
