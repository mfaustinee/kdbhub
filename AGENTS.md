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
- `/services/db.ts`: Handles all Supabase CRUD operations, returns querying, and validation saving.
- `/components/DataValidationModule.tsx`: Implements the Data Validation interface, quantity injection pipeline, and form persistence to `kdb_validations` & `data_validations`.
- `/components/ClientReturnsModule.tsx`: Manages CSV/Excel returns ingestion and financial balance tracking.
- `/api/index.ts`: Server-side API endpoints and fallback file loggers.
- `/types.ts`: Global TypeScript interfaces (`ClientReturn`, `DataValidation`, `AgreementData`, `ClosureNotificationData`, `ComplaintData`, `InquiryData`).

## 3. UI Variables & State Registry
- `formData`: React state object containing all Data Validation form fields (`dboName`, `premiseName`, `permitNo`, `location`, `category`, `contacts`, `expiryDate`, `validationPeriod`, `sales`, `distributors`, `nonCompliance`, `comments`, `complianceOfficer`, `confirmationName`, `designation`, `dboSignature`, `complianceSignature`).
- `returnsData`: Ingested `ClientReturn[]` records used by the quantity injection pipeline.
- `declarations`: Object tracking compliance checkboxes (`accurate`, `offense`, `awareness`).
- `kdb_validations` / `data_validations`: Supabase database tables for validation records.

## 4. Code Lockout Policy & Module Isolation (CRITICAL - DO NOT ALTER)
- DO NOT rewrite, alter, break, or remove code, tables, or generation pipelines related to:
  1. **Agreements PDF**
  2. **Closure/Cessations PDF**
  3. **Data Validation Module & Dependent Pipelines**:
     - `/components/DataValidationModule.tsx`
     - Data Validation CRUD operations & Supabase/local persistence handlers (`saveValidation`, `getValidations`, `deleteValidation`) in `/services/db.ts`
     - Quantity Injection Pipeline (`Returns -> Data Validation`)
     - `kdb_validations` & `data_validations` database tables, PDF generation, and storage pipelines
- Keep these core modules and pipelines strictly isolated, self-contained, and protected from unintended app-wide side effects or breaking structural changes.

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
1. **Quantity Injection Pipeline (Returns -> Data Validation)**:
   - Match client + period in Returns module.
   - Inject `qty` into "Quantity Declared" field under Local Sales, or set "Not Filed" if no row exists.
2. **Data Validation PDF Persistence**:
   - Saves records to Supabase table `kdb_validations` (including PDF path / inline base64 in `raw_data`).
   - Retrieval checks both `kdb_validations` table and `ValidationPdfs` storage bucket for legacy compatibility.
