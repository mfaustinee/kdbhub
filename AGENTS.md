# Application Rules & Foundation Guidelines

## 1. System Overview, Programming Languages & Core Tech Stack
- **Languages**: TypeScript (Strict typing), HTML5, CSS3 (Tailwind CSS v4).
- **Frontend Stack**: React 18+, Vite, Framer Motion, Lucide Icons, Canvas Signature Pad, jspdf & html2canvas for PDF rendering.
- **Backend Stack**: Node.js, Express (`/api/index.ts`).
- **Database & Storage**: Supabase (PostgreSQL) via official SDK (`@supabase/supabase-client`), Supabase Storage Bucket (`ValidationPdfs`), and `services/db.ts` service handler.
- **Source of Truth**: Manual upload (CSV/Excel `.xlsx`) or standard form entry is the absolute source of truth.
- **Reporting Engine**: Deterministic calculation formulas across 4 fiscal timelines:
  - **Monthly**: Current calendar month.
  - **Quarterly**: Q1 (July–Sept), Q2 (Oct–Dec), Q3 (Jan–Mar), Q4 (Apr–June).
  - **Half-Year**: H1 (July–Dec), H2 (Jan–June).
  - **Annual**: Filtered by the specified `year` field.
  - **Validations Counter**: Each report aggregates and displays total completed/submitted validation forms within that timeline boundary.
- **No AI Dependencies**: Runtime calculations and validation pipelines use deterministic TypeScript code logic and math formulas.

## 2. Core Architecture & Key Code Files
- `/services/db.ts`: Handles all Supabase CRUD operations, client matching & upserting (overwriting existing client records by ID / permit number / DBO + premise name to avoid duplicates), returns querying, and validation saving.
- `/components/DataValidationModule.tsx`: Implements the Data Validation interface, 7-point reconciliation pre-flight loop with branch differentiation, quantity injection pipeline, and form persistence to `kdb_validations` & `data_validations`.
- `/components/LicensedClientsModule.tsx`: Manages licensed client records, premises, and multi-branch registries.
- `/components/ClientReturnsModule.tsx`: Manages CSV/Excel returns ingestion and financial balance tracking.
- `/api/index.ts`: Server-side API endpoints and fallback file loggers.
- `/types.ts`: Global TypeScript interfaces (`LicensedClient`, `ClientBranch`, `ClientReturn`, `DataValidation`, `AgreementData`, `ClosureNotificationData`, `ComplaintData`, `InquiryData`).

## 3. UI Variables & State Registry
- `formData`: React state object containing all Data Validation form fields (`dboName`, `premiseName`, `permitNo`, `location`, `category`, `contacts`, `expiryDate`, `validationPeriod`, `sales`, `distributors`, `nonCompliance`, `comments`, `complianceOfficer`, `confirmationName`, `designation`, `dboSignature`, `complianceSignature`).
- `selectedClient`: Currently active `LicensedClient` object (includes client profile, primary premise, and `branches?: ClientBranch[]`).
- `mismatchFields`: Array of 7-point reconciliation mismatch items `{ key, label, validationVal, clientVal, selectedVal }`.
- `returnsData`: Ingested `ClientReturn[]` records used by the quantity injection pipeline.
- `declarations`: Object tracking compliance checkboxes (`accurate`, `offense`, `awareness`).
- `kdb_validations` / `data_validations`: Supabase database tables for validation records.
- `licensed_clients`: Core Supabase table for licensed clients and branch profiles.

## 4. Code Lockout Policy (CRITICAL - DO NOT ALTER)
- DO NOT rewrite, alter, or remove code, tables, or generation pipelines related to:
  1. **Agreements PDF**
  2. **Closure/Cessations PDF**
- Keep these modules strictly isolated and intact.

## 5. Required Ingestion Schema (Returns Import)
When writing ingestion or manual entry scripts for returns, strictly map and validate these 14 columns:
1. `clientname`
2. `year`
3. `period`
4. `qty`
5. `invoiceamount`
6. `returndate`
7. `paymentamount`
8. `paymentdate`
9. `txnref`
10. `lesscf`
11. `outstandingbalance`
12. `agingdays`
13. `paymentstatus`
14. `comments`

## 6. Cross-Module Interdependency & Data Bridge
1. **7-Point Reconciliation Loop (Data Validation <-> Clients)**:
   - Pre-flight check on 7 data points:
     - `name of dbo` <-> `clientname`
     - `premise name` <-> `premises` (includes branch identification)
     - `permit number` <-> `permit_number`
     - `location` <-> `location` (includes branch address)
     - `category` <-> `category`
     - `contacts` <-> `contacts`
     - `expiry date` <-> `expiry_date`
   - **Branch Differentiation**: Displays branch name, location, permit number, and all associated client branches in the reconciliation interface so officers can easily differentiate between parent facilities and branches.
   - **Condition A (Match)**: Proceed seamlessly to form.
   - **Condition B (Mismatch)**: Display side-by-side reconciliation interface with branch context. Require user selection. Overwrite/synchronize selected source of truth into BOTH Data Validation state and existing client row in `licensed_clients` Supabase table (never duplicating client records).
2. **Quantity Injection Pipeline (Returns -> Data Validation)**:
   - Match client + period in Returns module.
   - Inject `qty` into "Quantity Declared" field under Local Sales, or set "Not Filed" if no row exists.
3. **Data Validation PDF Persistence**:
   - Saves records to Supabase table `kdb_validations` (including PDF path / inline base64 in `raw_data`).
   - Retrieval checks both `kdb_validations` table and `ValidationPdfs` storage bucket for legacy compatibility.
