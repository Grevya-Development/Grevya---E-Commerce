-- ============================================================================
-- Grevya Naturals: Seller application schema expansion (REVIEW ONLY)
-- ============================================================================
-- This migration is generated for manual review. It is NOT approved for
-- production execution until its assumptions, RLS design, and reapplication
-- strategy have been reviewed against the live database.
--
-- Scope:
--   * Adds nullable seller-application fields for the professional form.
--   * Creates application-owned child tables only.
--   * Does NOT modify RLS, Storage policies, existing triggers/functions,
--     seller_profiles, stores, warehouses, addresses, or seller_payouts.
--   * Does NOT change the existing UNIQUE constraints on registration_number
--     or tax_id. See the review-only reapplication plan below.
--
-- Important: no generic updated_at trigger convention was found in this
-- repository's schema files. This migration intentionally creates no trigger
-- or function; updated_at values need a later, separately reviewed strategy.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Existing seller_applications: nullable additions only
-- ---------------------------------------------------------------------------
-- Existing applications already exist in production. These fields are nullable
-- so no historical data is invented and no existing row is made invalid.

ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS year_established smallint,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS declaration_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declaration_version text;

-- These constraints are nullable-safe for existing rows. PAN must be stored
-- uppercase. GSTIN/tax_id receives no new CHECK because legacy production
-- values must be audited before applying a format constraint.
ALTER TABLE public.seller_applications
  ADD CONSTRAINT seller_applications_pan_number_format_check
    CHECK (
      pan_number IS NULL
      OR (pan_number = upper(pan_number)
          AND pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$')
    ),
  ADD CONSTRAINT seller_applications_year_established_range_check
    CHECK (
      year_established IS NULL
      OR year_established BETWEEN 1 AND 9999
    );

-- ---------------------------------------------------------------------------
-- 2. Application-owned addresses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seller_application_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  address_type text NOT NULL,
  address_line_1 text NOT NULL,
  address_line_2 text NULL,
  landmark text NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  country text NOT NULL DEFAULT 'India',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seller_application_addresses_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES public.seller_applications(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_addresses_type_check
    CHECK (address_type IN ('registered', 'pickup')),
  CONSTRAINT seller_application_addresses_application_type_key
    UNIQUE (application_id, address_type),
  -- Supports the warehouse composite foreign key below, ensuring that any
  -- referenced pickup address belongs to the same application.
  CONSTRAINT seller_application_addresses_id_application_key
    UNIQUE (id, application_id)
);

-- ---------------------------------------------------------------------------
-- 3. Application warehouse/pickup proposal
-- ---------------------------------------------------------------------------
-- The current form has one warehouse/pickup proposal. A unique application_id
-- enforces that current scope without introducing a multi-warehouse model.

CREATE TABLE IF NOT EXISTS public.seller_application_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  warehouse_name text NULL,
  pickup_same_as_registered boolean NOT NULL DEFAULT false,
  pickup_address_id uuid NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seller_application_warehouses_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES public.seller_applications(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_warehouses_pickup_address_application_fkey
    FOREIGN KEY (pickup_address_id, application_id)
    REFERENCES public.seller_application_addresses(id, application_id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_warehouses_one_per_application_key
    UNIQUE (application_id),
  CONSTRAINT seller_application_warehouses_pickup_address_check
    CHECK (
      (pickup_same_as_registered = true AND pickup_address_id IS NULL)
      OR (pickup_same_as_registered = false AND pickup_address_id IS NOT NULL)
    )
);

-- Note: the composite FK proves same-application ownership. It cannot, by
-- itself, prove pickup_address_id has address_type = 'pickup'. Enforce that
-- in the future application write path, or add a separately reviewed trigger
-- only if database-level cross-row type enforcement is required.

-- ---------------------------------------------------------------------------
-- 4. Proposed storefront and fulfillment configuration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seller_application_storefronts (
  application_id uuid PRIMARY KEY,
  store_name text NOT NULL,
  store_slug text NOT NULL,
  store_description text NOT NULL,
  support_email text NOT NULL,
  support_phone text NOT NULL,
  fulfillment_method text NOT NULL,
  processing_time text NOT NULL,
  return_handling text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seller_application_storefronts_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES public.seller_applications(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_storefronts_slug_format_check
    CHECK (store_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT seller_application_storefronts_fulfillment_method_check
    CHECK (fulfillment_method IN ('self_fulfillment', 'courier_partner', 'both')),
  CONSTRAINT seller_application_storefronts_processing_time_check
    CHECK (processing_time IN ('same_day', '1_2_days', '3_5_days', '5_plus_days')),
  CONSTRAINT seller_application_storefronts_return_handling_check
    CHECK (return_handling IN ('seller_managed', 'marketplace_managed', 'both'))
);

-- store_slug is intentionally not globally unique here. A proposed application
-- slug must be checked against public.stores.slug during the later approval
-- promotion transaction; a global application-only constraint cannot enforce
-- uniqueness across both tables.

-- ---------------------------------------------------------------------------
-- 5. Application status audit history
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seller_application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  from_status text NULL,
  to_status text NOT NULL,
  reason text NULL,
  changed_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seller_application_status_history_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES public.seller_applications(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_status_history_changed_by_fkey
    FOREIGN KEY (changed_by)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_status_history_to_status_check
    CHECK (to_status IN ('pending', 'under_review', 'approved', 'rejected')),
  CONSTRAINT seller_application_status_history_from_status_check
    CHECK (
      from_status IS NULL
      OR from_status IN ('pending', 'under_review', 'approved', 'rejected')
    )
);

-- ---------------------------------------------------------------------------
-- 6. Future document metadata (no Storage policy changes)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.seller_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  document_type text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'seller-documents',
  storage_path text NOT NULL,
  original_filename text NULL,
  mime_type text NULL,
  file_size_bytes bigint NULL,
  verification_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  rejection_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT seller_application_documents_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES public.seller_applications(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_documents_reviewed_by_fkey
    FOREIGN KEY (reviewed_by)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT,
  CONSTRAINT seller_application_documents_storage_bucket_check
    CHECK (storage_bucket = 'seller-documents'),
  CONSTRAINT seller_application_documents_file_size_check
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT seller_application_documents_verification_status_check
    CHECK (verification_status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT seller_application_documents_bucket_path_key
    UNIQUE (storage_bucket, storage_path)
);

-- ---------------------------------------------------------------------------
-- 7. Safe indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS seller_applications_user_created_at_idx
  ON public.seller_applications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_applications_status_created_at_idx
  ON public.seller_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_application_addresses_application_id_idx
  ON public.seller_application_addresses (application_id);

CREATE INDEX IF NOT EXISTS seller_application_warehouses_pickup_address_id_idx
  ON public.seller_application_warehouses (pickup_address_id);

CREATE INDEX IF NOT EXISTS seller_application_status_history_application_created_at_idx
  ON public.seller_application_status_history (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_application_documents_application_created_at_idx
  ON public.seller_application_documents (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_application_documents_verification_status_idx
  ON public.seller_application_documents (verification_status);

CREATE INDEX IF NOT EXISTS seller_application_storefronts_store_slug_idx
  ON public.seller_application_storefronts (store_slug);

COMMIT;

-- ============================================================================
-- REVIEW-ONLY: Reapplication uniqueness plan (NOT EXECUTED)
-- ============================================================================
-- The existing UNIQUE constraints on seller_applications.registration_number
-- and seller_applications.tax_id prevent a rejected seller from filing a new
-- historical application with the same legitimate credentials.
--
-- This migration deliberately does NOT drop or alter either constraint. Before
-- a later reapplication migration, manually run the read-only catalog and data
-- checks below, identify the exact live constraint/index names, and review
-- duplicate/active-application data. Only then should a reviewed migration:
--   1. replace global uniqueness with partial active-application uniqueness;
--   2. allow rejected historical applications to retain their identifiers; and
--   3. prevent concurrent active applications for the same user, registration,
--      or tax ID.
--
-- Proposed target indexes, shown for design review only:
--
--   CREATE UNIQUE INDEX seller_applications_one_active_user_idx
--     ON public.seller_applications (user_id)
--     WHERE status IN ('pending', 'under_review');
--
--   CREATE UNIQUE INDEX seller_applications_one_active_registration_idx
--     ON public.seller_applications (registration_number)
--     WHERE status IN ('pending', 'under_review');
--
--   CREATE UNIQUE INDEX seller_applications_one_active_tax_id_idx
--     ON public.seller_applications (tax_id)
--     WHERE status IN ('pending', 'under_review');
--
-- Risk: removing existing global uniqueness is a production behavior change.
-- It requires the exact constraint names and a data review, so it is excluded
-- from this migration.

-- ============================================================================
-- FUTURE RLS DESIGN (DOCUMENTATION ONLY; NO POLICIES CREATED HERE)
-- ============================================================================
-- Seller/applicant:
--   * SELECT only their own seller_applications and application child rows.
--   * INSERT only applications with user_id = auth.uid().
--   * UPDATE only editable application data; cannot set review fields/statuses.
--   * Cannot write status history, document review fields, or approvals.
-- Admin:
--   * SELECT all application records and child records.
--   * Update review/status fields and document review fields through a trusted
--     authorization model.
-- System/approval path:
--   * Performs promotion only through a separately reviewed trigger/function.
-- Storage:
--   * Future seller-documents policies must join object ownership to the
--     application user_id; do not trust a user-supplied storage path alone.

-- ============================================================================
-- FUTURE APPROVAL-PROMOTION DESIGN (DOCUMENTATION ONLY)
-- ============================================================================
-- The existing trg_seller_application_approval and
-- public.handle_seller_application_approval() are intentionally untouched.
-- A later dedicated migration may extend the pending -> approved path to copy
-- approved application data into seller_profiles, stores, seller-owned
-- addresses, and seller-owned warehouse records. This migration creates none
-- of those operational records or tables.

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (READ ONLY; DO NOT RUN AUTOMATICALLY)
-- ============================================================================
-- Verify added columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'seller_applications'
-- ORDER BY ordinal_position;
--
-- Verify new application tables:
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'seller_application_addresses',
--     'seller_application_warehouses',
--     'seller_application_storefronts',
--     'seller_application_status_history',
--     'seller_application_documents'
--   )
-- ORDER BY table_name;
--
-- Inspect existing seller_applications uniqueness before a later reapplication
-- migration:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.seller_applications'::regclass
-- ORDER BY conname;
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'seller_applications'
-- ORDER BY indexname;
--
-- Review applications that would conflict with the proposed active indexes:
-- SELECT user_id, count(*) AS active_count
-- FROM public.seller_applications
-- WHERE status IN ('pending', 'under_review')
-- GROUP BY user_id
-- HAVING count(*) > 1;
--
-- SELECT registration_number, count(*) AS active_count
-- FROM public.seller_applications
-- WHERE status IN ('pending', 'under_review')
-- GROUP BY registration_number
-- HAVING count(*) > 1;
--
-- SELECT tax_id, count(*) AS active_count
-- FROM public.seller_applications
-- WHERE status IN ('pending', 'under_review')
-- GROUP BY tax_id
-- HAVING count(*) > 1;
