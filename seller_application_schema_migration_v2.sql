-- ============================================================================
-- Grevya Naturals: Seller application schema expansion v3 (REVIEW ONLY)
-- ============================================================================
-- This migration is generated for manual review and is NOT approved for
-- production execution.
--
-- Scope:
--   * Adds nullable professional seller-application fields.
--   * Creates application-owned address, warehouse, storefront, and status
--     history tables.
--   * Enables and defines RLS only for those new tables.
--
-- Explicitly out of scope:
--   * seller_application_documents and Storage policies
--   * Existing seller_applications RLS policies or UNIQUE constraints
--   * Existing approval triggers/functions
--   * stores, seller_profiles, warehouses, addresses, seller_payouts, roles,
--     or user_roles
--
-- The live production seller_applications policy authorizes privileged users
-- through has_permission(current_profile_id(), 'user.manage').
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Existing seller_applications: nullable additions only
-- ---------------------------------------------------------------------------
-- Existing production applications are preserved. No values are backfilled or
-- invented, so every new field is initially nullable.

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

-- Nullable-safe for existing rows. PAN is stored uppercase. No new GSTIN/tax
-- check is added because legacy production data must be audited first.
ALTER TABLE public.seller_applications
  ADD CONSTRAINT seller_applications_pan_number_format_check
    CHECK (
      pan_number IS NULL
      OR (
        pan_number = upper(pan_number)
        AND pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
      )
    );

-- year_established intentionally has no database CHECK constraint. Its valid
-- upper bound changes each year and must be enforced by application/service
-- validation.

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
  -- Supports the warehouse composite foreign key below.
  CONSTRAINT seller_application_addresses_id_application_key
    UNIQUE (id, application_id)
);

-- ---------------------------------------------------------------------------
-- 3. Application warehouse/pickup proposal
-- ---------------------------------------------------------------------------
-- The current form supports one proposal only; application_id is therefore
-- unique rather than creating a multi-warehouse design prematurely.

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

-- The composite FK guarantees that pickup_address_id belongs to the same
-- application. Application/service validation must ensure it is the address
-- whose address_type is 'pickup'; no new trigger is introduced here.

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

-- store_slug is deliberately not globally unique in this table. A later
-- approval-promotion transaction must check the proposed value against live
-- public.stores.slug before creating a storefront.

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
-- 6. Safe indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS seller_applications_user_created_at_idx
  ON public.seller_applications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_applications_status_created_at_idx
  ON public.seller_applications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_application_addresses_application_id_idx
  ON public.seller_application_addresses (application_id);

CREATE INDEX IF NOT EXISTS seller_application_warehouses_pickup_address_id_idx
  ON public.seller_application_warehouses (pickup_address_id);

CREATE INDEX IF NOT EXISTS seller_application_storefronts_store_slug_idx
  ON public.seller_application_storefronts (store_slug);

CREATE INDEX IF NOT EXISTS seller_application_status_history_application_created_at_idx
  ON public.seller_application_status_history (application_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. RLS: enabled only for the NEW application tables
-- ---------------------------------------------------------------------------
-- No existing RLS policy is changed. seller_applications is intentionally not
-- altered here; its existing policy design remains in force.

ALTER TABLE public.seller_application_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_application_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_application_storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_application_status_history ENABLE ROW LEVEL SECURITY;

-- Applicants may read only child rows linked to their own application. Privileged
-- users use the same user.manage permission as the live seller_applications policy.
CREATE POLICY "Seller application addresses selectable by owner or admin"
  ON public.seller_application_addresses
  FOR SELECT
  USING (
    has_permission(current_profile_id(), 'user.manage')
    OR EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_addresses.application_id
        AND application.user_id = auth.uid()
    )
  );

CREATE POLICY "Seller application warehouses selectable by owner or admin"
  ON public.seller_application_warehouses
  FOR SELECT
  USING (
    has_permission(current_profile_id(), 'user.manage')
    OR EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_warehouses.application_id
        AND application.user_id = auth.uid()
    )
  );

CREATE POLICY "Seller application storefronts selectable by owner or admin"
  ON public.seller_application_storefronts
  FOR SELECT
  USING (
    has_permission(current_profile_id(), 'user.manage')
    OR EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_storefronts.application_id
        AND application.user_id = auth.uid()
    )
  );

CREATE POLICY "Seller application status history selectable by owner or admin"
  ON public.seller_application_status_history
  FOR SELECT
  USING (
    has_permission(current_profile_id(), 'user.manage')
    OR EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_status_history.application_id
        AND application.user_id = auth.uid()
    )
  );

-- Applicants may create child records only for their own pending application.
-- Under-review, approved, and rejected application records are not editable
-- through these child-table policies.
CREATE POLICY "Seller application addresses insertable by editable owner"
  ON public.seller_application_addresses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_addresses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

CREATE POLICY "Seller application warehouses insertable by editable owner"
  ON public.seller_application_warehouses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_warehouses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

CREATE POLICY "Seller application storefronts insertable by editable owner"
  ON public.seller_application_storefronts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_storefronts.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

-- Applicants may update only their own pending child records. They cannot
-- reassign a child row to another application because WITH CHECK repeats the
-- ownership and editable-status test for the new row.
CREATE POLICY "Seller application addresses updatable by editable owner"
  ON public.seller_application_addresses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_addresses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_addresses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

CREATE POLICY "Seller application warehouses updatable by editable owner"
  ON public.seller_application_warehouses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_warehouses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_warehouses.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

CREATE POLICY "Seller application storefronts updatable by editable owner"
  ON public.seller_application_storefronts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_storefronts.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.seller_applications application
      WHERE application.id = seller_application_storefronts.application_id
        AND application.user_id = auth.uid()
        AND application.status = 'pending'
    )
  );

-- No INSERT, UPDATE, or DELETE policy is created for
-- seller_application_status_history. Ordinary authenticated sellers therefore
-- cannot forge or change history. A future trusted review/approval path may
-- write history with a separately reviewed security-definer function, trigger,
-- or server-side service role.
--
-- No applicant DELETE policy is created for application child tables. This
-- preserves application evidence; sellers can correct editable records by
-- UPDATE instead.

COMMIT;

-- ============================================================================
-- REVIEW-ONLY: Reapplication uniqueness plan (NOT EXECUTED)
-- ============================================================================
-- Existing UNIQUE constraints on registration_number and tax_id remain intact.
-- They prevent a rejected seller from filing a new historical application with
-- the same credentials. Do not remove them automatically.
--
-- A future, separately approved migration must first inspect exact live
-- constraint/index names and active-application data, then may replace global
-- uniqueness with partial active-application unique indexes. Target design:
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
-- Risk: changing global uniqueness is a material production behavior change.
-- It is intentionally excluded from this migration.

-- ============================================================================
-- FUTURE APPROVAL-PROMOTION DESIGN (DOCUMENTATION ONLY)
-- ============================================================================
-- trg_seller_application_approval and
-- public.handle_seller_application_approval() are intentionally untouched.
-- A later dedicated migration may extend pending -> approved promotion into
-- seller_profiles, stores, seller-owned addresses, and seller-owned warehouse
-- records. This migration creates none of those operational records.

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (READ ONLY; DO NOT RUN AUTOMATICALLY)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'seller_applications'
-- ORDER BY ordinal_position;
--
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'seller_application_addresses',
--     'seller_application_warehouses',
--     'seller_application_storefronts',
--     'seller_application_status_history'
--   )
-- ORDER BY table_name;
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'seller_application_addresses',
--     'seller_application_warehouses',
--     'seller_application_storefronts',
--     'seller_application_status_history'
--   )
-- ORDER BY tablename;
--
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'seller_application_addresses',
--     'seller_application_warehouses',
--     'seller_application_storefronts',
--     'seller_application_status_history'
--   )
-- ORDER BY tablename, policyname;
--
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