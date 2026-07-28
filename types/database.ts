export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      active_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          agency_name: string | null
          agent_full_name: string | null
          bio: string | null
          commission_rate: number | null
          commission_rate_display: string | null
          created_at: string
          discovery_ui_mode: Database["public"]["Enums"]["ui_mode"]
          display_theme: Database["public"]["Enums"]["display_theme"]
          geographic_regions: string[]
          id: string
          is_verified: boolean
          linkedin_url: string | null
          logo_url: string | null
          notification_prefs: Json
          services_offered: string[]
          sports_specialisms: string[]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["agent_verification_status"]
          verified_at: string | null
          website_url: string | null
          years_in_industry: number | null
        }
        Insert: {
          agency_name?: string | null
          agent_full_name?: string | null
          bio?: string | null
          commission_rate?: number | null
          commission_rate_display?: string | null
          created_at?: string
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          geographic_regions?: string[]
          id?: string
          is_verified?: boolean
          linkedin_url?: string | null
          logo_url?: string | null
          notification_prefs?: Json
          services_offered?: string[]
          sports_specialisms?: string[]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["agent_verification_status"]
          verified_at?: string | null
          website_url?: string | null
          years_in_industry?: number | null
        }
        Update: {
          agency_name?: string | null
          agent_full_name?: string | null
          bio?: string | null
          commission_rate?: number | null
          commission_rate_display?: string | null
          created_at?: string
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          geographic_regions?: string[]
          id?: string
          is_verified?: boolean
          linkedin_url?: string | null
          logo_url?: string | null
          notification_prefs?: Json
          services_offered?: string[]
          sports_specialisms?: string[]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["agent_verification_status"]
          verified_at?: string | null
          website_url?: string | null
          years_in_industry?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          academy_club: string | null
          action_photos: string[]
          availability_status:
            | Database["public"]["Enums"]["availability_status"]
            | null
          available_from_date: string | null
          chat_retention_days: number | null
          created_at: string
          date_of_birth: string | null
          discovery_ui_mode: Database["public"]["Enums"]["ui_mode"]
          display_name: string | null
          display_theme: Database["public"]["Enums"]["display_theme"]
          full_legal_name: string | null
          guardian_accepted_at: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          has_agent: boolean
          height_cm: number | null
          highest_level: Database["public"]["Enums"]["athlete_level"] | null
          highlight_videos: string[]
          home_city: string | null
          home_country: string | null
          id: string
          is_under_18: boolean
          last_active_at: string | null
          level: Database["public"]["Enums"]["athlete_level"] | null
          national_programme: string | null
          notable_achievements: string | null
          notification_prefs: Json
          payout_account_holder: string | null
          payout_account_last4: string | null
          payout_bank_name: string | null
          payout_country: string | null
          payout_method: Database["public"]["Enums"]["payout_method"] | null
          payout_sort_code_last4: string | null
          performance_stats: Json
          phone: string | null
          position: string | null
          primary_sport: string | null
          profile_photo_url: string | null
          secondary_sport: string | null
          seeking: Database["public"]["Enums"]["seeking_type"][]
          social_accounts: Json
          status: Database["public"]["Enums"]["profile_status"]
          stripe_connect_account_id: string | null
          stripe_connect_onboarded_at: string | null
          stripe_connect_status:
            | Database["public"]["Enums"]["stripe_connect_status"]
            | null
          travel_radius_km: number | null
          university_team: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
          years_active: number | null
        }
        Insert: {
          academy_club?: string | null
          action_photos?: string[]
          availability_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          available_from_date?: string | null
          chat_retention_days?: number | null
          created_at?: string
          date_of_birth?: string | null
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_name?: string | null
          display_theme?: Database["public"]["Enums"]["display_theme"]
          full_legal_name?: string | null
          guardian_accepted_at?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          has_agent?: boolean
          height_cm?: number | null
          highest_level?: Database["public"]["Enums"]["athlete_level"] | null
          highlight_videos?: string[]
          home_city?: string | null
          home_country?: string | null
          id?: string
          is_under_18?: boolean
          last_active_at?: string | null
          level?: Database["public"]["Enums"]["athlete_level"] | null
          national_programme?: string | null
          notable_achievements?: string | null
          notification_prefs?: Json
          payout_account_holder?: string | null
          payout_account_last4?: string | null
          payout_bank_name?: string | null
          payout_country?: string | null
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_sort_code_last4?: string | null
          performance_stats?: Json
          phone?: string | null
          position?: string | null
          primary_sport?: string | null
          profile_photo_url?: string | null
          secondary_sport?: string | null
          seeking?: Database["public"]["Enums"]["seeking_type"][]
          social_accounts?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?:
            | Database["public"]["Enums"]["stripe_connect_status"]
            | null
          travel_radius_km?: number | null
          university_team?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          years_active?: number | null
        }
        Update: {
          academy_club?: string | null
          action_photos?: string[]
          availability_status?:
            | Database["public"]["Enums"]["availability_status"]
            | null
          available_from_date?: string | null
          chat_retention_days?: number | null
          created_at?: string
          date_of_birth?: string | null
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_name?: string | null
          display_theme?: Database["public"]["Enums"]["display_theme"]
          full_legal_name?: string | null
          guardian_accepted_at?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          has_agent?: boolean
          height_cm?: number | null
          highest_level?: Database["public"]["Enums"]["athlete_level"] | null
          highlight_videos?: string[]
          home_city?: string | null
          home_country?: string | null
          id?: string
          is_under_18?: boolean
          last_active_at?: string | null
          level?: Database["public"]["Enums"]["athlete_level"] | null
          national_programme?: string | null
          notable_achievements?: string | null
          notification_prefs?: Json
          payout_account_holder?: string | null
          payout_account_last4?: string | null
          payout_bank_name?: string | null
          payout_country?: string | null
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_sort_code_last4?: string | null
          performance_stats?: Json
          phone?: string | null
          position?: string | null
          primary_sport?: string | null
          profile_photo_url?: string | null
          secondary_sport?: string | null
          seeking?: Database["public"]["Enums"]["seeking_type"][]
          social_accounts?: Json
          status?: Database["public"]["Enums"]["profile_status"]
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded_at?: string | null
          stripe_connect_status?:
            | Database["public"]["Enums"]["stripe_connect_status"]
            | null
          travel_radius_km?: number | null
          university_team?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          years_active?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_2fa: {
        Row: {
          confirmed_at: string | null
          created_at: string
          enabled: boolean
          recovery_codes: string[]
          secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          enabled?: boolean
          recovery_codes?: string[]
          secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          enabled?: boolean
          recovery_codes?: string[]
          secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_2fa_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_rate_limits: {
        Row: {
          attempts: number
          key: string
          updated_at: string
          window_started: string
        }
        Insert: {
          attempts?: number
          key: string
          updated_at?: string
          window_started?: string
        }
        Update: {
          attempts?: number
          key?: string
          updated_at?: string
          window_started?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_consent_tokens: {
        Row: {
          athlete_user_id: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          athlete_user_id: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          athlete_user_id?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_consent_tokens_athlete_user_id_fkey"
            columns: ["athlete_user_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          company_name: string
          company_registration_number: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          discovery_ui_mode: Database["public"]["Enums"]["ui_mode"]
          display_theme: Database["public"]["Enums"]["display_theme"]
          geographic_preference: string | null
          headquarters_city: string | null
          headquarters_country: string | null
          id: string
          industry: Database["public"]["Enums"]["brand_industry"] | null
          linkedin_url: string
          logo_url: string | null
          notification_prefs: Json
          rejection_reason: string | null
          seeking: string[]
          social_accounts: Json
          status: Database["public"]["Enums"]["brand_status"]
          target_level: string | null
          target_sports: string[]
          trading_name: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
          website_url: string | null
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          company_name: string
          company_registration_number?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          geographic_preference?: string | null
          headquarters_city?: string | null
          headquarters_country?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["brand_industry"] | null
          linkedin_url: string
          logo_url?: string | null
          notification_prefs?: Json
          rejection_reason?: string | null
          seeking?: string[]
          social_accounts?: Json
          status?: Database["public"]["Enums"]["brand_status"]
          target_level?: string | null
          target_sports?: string[]
          trading_name?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
          website_url?: string | null
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          company_name?: string
          company_registration_number?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          geographic_preference?: string | null
          headquarters_city?: string | null
          headquarters_country?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["brand_industry"] | null
          linkedin_url?: string
          logo_url?: string | null
          notification_prefs?: Json
          rejection_reason?: string | null
          seeking?: string[]
          social_accounts?: Json
          status?: Database["public"]["Enums"]["brand_status"]
          target_level?: string | null
          target_sports?: string[]
          trading_name?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          recipient_id: string
          responded_at: string | null
          sender_id: string
          sent_at: string
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agent_id: string | null
          agent_signed_at: string | null
          agent_signer_ip: string | null
          athlete_or_team_id: string
          athlete_signed_at: string | null
          athlete_signer_device: string | null
          athlete_signer_ip: string | null
          brand_id: string
          brand_signed_at: string | null
          brand_signer_device: string | null
          brand_signer_ip: string | null
          created_at: string
          document_url: string | null
          esignature_envelope_id: string | null
          esignature_provider: string | null
          id: string
          locked_at: string | null
          match_id: string
          proposal_id: string
          retain_until: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terminated_at: string | null
          termination_reason: string | null
          terms_snapshot: Json | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_signed_at?: string | null
          agent_signer_ip?: string | null
          athlete_or_team_id: string
          athlete_signed_at?: string | null
          athlete_signer_device?: string | null
          athlete_signer_ip?: string | null
          brand_id: string
          brand_signed_at?: string | null
          brand_signer_device?: string | null
          brand_signer_ip?: string | null
          created_at?: string
          document_url?: string | null
          esignature_envelope_id?: string | null
          esignature_provider?: string | null
          id?: string
          locked_at?: string | null
          match_id: string
          proposal_id: string
          retain_until?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_signed_at?: string | null
          agent_signer_ip?: string | null
          athlete_or_team_id?: string
          athlete_signed_at?: string | null
          athlete_signer_device?: string | null
          athlete_signer_ip?: string | null
          brand_id?: string
          brand_signed_at?: string | null
          brand_signer_device?: string | null
          brand_signer_ip?: string | null
          created_at?: string
          document_url?: string | null
          esignature_envelope_id?: string | null
          esignature_provider?: string | null
          id?: string
          locked_at?: string | null
          match_id?: string
          proposal_id?: string
          retain_until?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          terms_snapshot?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_athlete_or_team_id_fkey"
            columns: ["athlete_or_team_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          expires_at: string | null
          id: string
          requested_at: string
          status: Database["public"]["Enums"]["data_export_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["data_export_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["data_export_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          provider_id: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          to_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          to_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          provider_id?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string
          to_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          detail: string | null
          email: string
          reason: Database["public"]["Enums"]["email_suppression_reason"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email: string
          reason: Database["public"]["Enums"]["email_suppression_reason"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          email?: string
          reason?: Database["public"]["Enums"]["email_suppression_reason"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_suppressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          application_deadline: string | null
          brand_id: string
          contract_duration_months: number | null
          created_at: string
          deliverables: Json
          description: string | null
          exclusivity_required: boolean
          id: string
          is_remote: boolean
          level_required: string | null
          location: string | null
          max_hires: number | null
          multiple_hires: boolean
          number_of_teams_sought: number | null
          pay_amount: number | null
          pay_currency: string
          pay_type: Database["public"]["Enums"]["pay_type"] | null
          sponsorship_structure: string | null
          sport_required: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          total_sponsorship_budget: number | null
          type: Database["public"]["Enums"]["listing_type"]
          updated_at: string
          usage_rights: Json | null
          what_expected: Json | null
        }
        Insert: {
          application_deadline?: string | null
          brand_id: string
          contract_duration_months?: number | null
          created_at?: string
          deliverables?: Json
          description?: string | null
          exclusivity_required?: boolean
          id?: string
          is_remote?: boolean
          level_required?: string | null
          location?: string | null
          max_hires?: number | null
          multiple_hires?: boolean
          number_of_teams_sought?: number | null
          pay_amount?: number | null
          pay_currency?: string
          pay_type?: Database["public"]["Enums"]["pay_type"] | null
          sponsorship_structure?: string | null
          sport_required?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          total_sponsorship_budget?: number | null
          type: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          usage_rights?: Json | null
          what_expected?: Json | null
        }
        Update: {
          application_deadline?: string | null
          brand_id?: string
          contract_duration_months?: number | null
          created_at?: string
          deliverables?: Json
          description?: string | null
          exclusivity_required?: boolean
          id?: string
          is_remote?: boolean
          level_required?: string | null
          location?: string | null
          max_hires?: number | null
          multiple_hires?: boolean
          number_of_teams_sought?: number | null
          pay_amount?: number | null
          pay_currency?: string
          pay_type?: Database["public"]["Enums"]["pay_type"] | null
          sponsorship_structure?: string | null
          sport_required?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          total_sponsorship_budget?: number | null
          type?: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          usage_rights?: Json | null
          what_expected?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          location: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          location?: string | null
          success: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          location?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          connection_request_id: string | null
          created_at: string
          id: string
          matched_at: string
          proposal_required: boolean
          proposal_sent: boolean
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          connection_request_id?: string | null
          created_at?: string
          id?: string
          matched_at?: string
          proposal_required?: boolean
          proposal_sent?: boolean
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          connection_request_id?: string | null
          created_at?: string
          id?: string
          matched_at?: string
          proposal_required?: boolean
          proposal_sent?: boolean
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_connection_request_id_fkey"
            columns: ["connection_request_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          created_at: string
          last_read_at: string
          match_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_read_at?: string
          match_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_read_at?: string
          match_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_mime_type: string | null
          attachment_size_bytes: number | null
          attachment_url: string | null
          content_type: Database["public"]["Enums"]["message_type"]
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          match_id: string
          metadata: Json
          sender_id: string
          sent_at: string
          text_content: string | null
        }
        Insert: {
          attachment_mime_type?: string | null
          attachment_size_bytes?: number | null
          attachment_url?: string | null
          content_type: Database["public"]["Enums"]["message_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          match_id: string
          metadata?: Json
          sender_id: string
          sent_at?: string
          text_content?: string | null
        }
        Update: {
          attachment_mime_type?: string | null
          attachment_size_bytes?: number | null
          attachment_url?: string | null
          content_type?: Database["public"]["Enums"]["message_type"]
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          match_id?: string
          metadata?: Json
          sender_id?: string
          sent_at?: string
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          event_type: string
          id: string
          metadata: Json
          read_at: string | null
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          read_at?: string | null
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          currency: string
          id: string
          net_amount: number | null
          payee_id: string
          payer_id: string
          platform_fee: number | null
          processed_at: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_fee: number | null
          stripe_payment_intent_id: string
          tax_disclaimer_shown: boolean
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          currency?: string
          id?: string
          net_amount?: number | null
          payee_id: string
          payer_id: string
          platform_fee?: number | null
          processed_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_fee?: number | null
          stripe_payment_intent_id: string
          tax_disclaimer_shown?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          currency?: string
          id?: string
          net_amount?: number | null
          payee_id?: string
          payer_id?: string
          platform_fee?: number | null
          processed_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_fee?: number | null
          stripe_payment_intent_id?: string
          tax_disclaimer_shown?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_settings: {
        Row: {
          created_at: string
          discoverable: boolean
          display_currency: Database["public"]["Enums"]["display_currency"]
          email_digest: Database["public"]["Enums"]["email_digest"]
          id: string
          location_precision: Database["public"]["Enums"]["location_precision"]
          marketing_opt_in: boolean
          notification_matrix: Json
          pause_matches: boolean
          profile_visible: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          section_visibility: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discoverable?: boolean
          display_currency?: Database["public"]["Enums"]["display_currency"]
          email_digest?: Database["public"]["Enums"]["email_digest"]
          id?: string
          location_precision?: Database["public"]["Enums"]["location_precision"]
          marketing_opt_in?: boolean
          notification_matrix?: Json
          pause_matches?: boolean
          profile_visible?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          section_visibility?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discoverable?: boolean
          display_currency?: Database["public"]["Enums"]["display_currency"]
          email_digest?: Database["public"]["Enums"]["email_digest"]
          id?: string
          location_precision?: Database["public"]["Enums"]["location_precision"]
          marketing_opt_in?: boolean
          notification_matrix?: Json
          pause_matches?: boolean
          profile_visible?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          section_visibility?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          additional_terms: string | null
          created_at: string
          deliverables: Json
          id: string
          match_id: string
          parent_proposal_id: string | null
          pay_amount: number
          pay_currency: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          timeline_end: string | null
          timeline_start: string | null
          title: string
          updated_at: string
          usage_rights: Json | null
        }
        Insert: {
          additional_terms?: string | null
          created_at?: string
          deliverables?: Json
          id?: string
          match_id: string
          parent_proposal_id?: string | null
          pay_amount: number
          pay_currency?: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          responded_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          timeline_end?: string | null
          timeline_start?: string | null
          title: string
          updated_at?: string
          usage_rights?: Json | null
        }
        Update: {
          additional_terms?: string | null
          created_at?: string
          deliverables?: Json
          id?: string
          match_id?: string
          parent_proposal_id?: string | null
          pay_amount?: number
          pay_currency?: string
          pay_type?: Database["public"]["Enums"]["pay_type"]
          responded_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          timeline_end?: string | null
          timeline_start?: string | null
          title?: string
          updated_at?: string
          usage_rights?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          detail: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_message_id: string | null
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      representation_links: {
        Row: {
          accepted_at: string | null
          agent_id: string
          can_edit_profile: boolean
          can_message: boolean
          can_sign_contracts: boolean
          client_role: Database["public"]["Enums"]["user_role"]
          client_user_id: string
          commission_rate: string | null
          contract_duration_months: number | null
          created_at: string
          id: string
          requested_at: string
          status: Database["public"]["Enums"]["link_status"]
          terminated_at: string | null
          termination_reason: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agent_id: string
          can_edit_profile?: boolean
          can_message?: boolean
          can_sign_contracts?: boolean
          client_role: Database["public"]["Enums"]["user_role"]
          client_user_id: string
          commission_rate?: string | null
          contract_duration_months?: number | null
          created_at?: string
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["link_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string
          can_edit_profile?: boolean
          can_message?: boolean
          can_sign_contracts?: boolean
          client_role?: Database["public"]["Enums"]["user_role"]
          client_user_id?: string
          commission_rate?: string | null
          contract_duration_months?: number | null
          created_at?: string
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["link_status"]
          terminated_at?: string | null
          termination_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representation_links_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representation_links_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shortlists: {
        Row: {
          created_at: string
          id: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortlists_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          attempts: number
          claimed_at: string | null
          error: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          received_at: string
          status: Database["public"]["Enums"]["stripe_webhook_event_status"]
          type: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          error?: string | null
          id: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["stripe_webhook_event_status"]
          type: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["stripe_webhook_event_status"]
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          brand_id: string
          canceled_at: string | null
          cancellation_scheduled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          seats_total: number
          seats_used: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          tier: number
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          canceled_at?: string | null
          cancellation_scheduled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          seats_total?: number
          seats_used?: number
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          tier: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          canceled_at?: string | null
          cancellation_scheduled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          seats_total?: number
          seats_used?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tier?: number
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_admins: {
        Row: {
          accepted_at: string | null
          created_at: string
          full_name: string | null
          id: string
          invite_status: Database["public"]["Enums"]["team_admin_invite_status"]
          invited_at: string
          invited_by: string | null
          invited_email: string
          role: Database["public"]["Enums"]["team_admin_role"]
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          invite_status?: Database["public"]["Enums"]["team_admin_invite_status"]
          invited_at?: string
          invited_by?: string | null
          invited_email: string
          role?: Database["public"]["Enums"]["team_admin_role"]
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          invite_status?: Database["public"]["Enums"]["team_admin_invite_status"]
          invited_at?: string
          invited_by?: string | null
          invited_email?: string
          role?: Database["public"]["Enums"]["team_admin_role"]
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_admins_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_admins_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_profiles: {
        Row: {
          annual_sponsorship_target: number | null
          bio: string | null
          commercial_manager_email: string | null
          commercial_manager_name: string | null
          commercial_manager_phone: string | null
          competition_level: Database["public"]["Enums"]["team_level"] | null
          cover_photo_url: string | null
          created_at: string
          discovery_ui_mode: Database["public"]["Enums"]["ui_mode"]
          display_theme: Database["public"]["Enums"]["display_theme"]
          fan_reach: Database["public"]["Enums"]["fan_reach"] | null
          home_city: string | null
          home_country: string | null
          home_venue: string | null
          id: string
          logo_url: string | null
          match_day_attendance: number | null
          media_pack_url: string | null
          nickname: string | null
          notification_prefs: Json
          offers_to_sponsors: Json
          press_mentions: string | null
          primary_controller_email: string | null
          primary_controller_name: string | null
          primary_controller_phone: string | null
          primary_controller_role: string | null
          seeking_sponsorship_types: string[]
          social_accounts: Json
          sponsorship_brief_url: string | null
          sports: string[]
          status: Database["public"]["Enums"]["profile_status"]
          team_name: string | null
          total_social_following: number
          total_sponsorship_value_sought: number | null
          updated_at: string
          user_id: string
          year_founded: number | null
        }
        Insert: {
          annual_sponsorship_target?: number | null
          bio?: string | null
          commercial_manager_email?: string | null
          commercial_manager_name?: string | null
          commercial_manager_phone?: string | null
          competition_level?: Database["public"]["Enums"]["team_level"] | null
          cover_photo_url?: string | null
          created_at?: string
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          fan_reach?: Database["public"]["Enums"]["fan_reach"] | null
          home_city?: string | null
          home_country?: string | null
          home_venue?: string | null
          id?: string
          logo_url?: string | null
          match_day_attendance?: number | null
          media_pack_url?: string | null
          nickname?: string | null
          notification_prefs?: Json
          offers_to_sponsors?: Json
          press_mentions?: string | null
          primary_controller_email?: string | null
          primary_controller_name?: string | null
          primary_controller_phone?: string | null
          primary_controller_role?: string | null
          seeking_sponsorship_types?: string[]
          social_accounts?: Json
          sponsorship_brief_url?: string | null
          sports?: string[]
          status?: Database["public"]["Enums"]["profile_status"]
          team_name?: string | null
          total_social_following?: number
          total_sponsorship_value_sought?: number | null
          updated_at?: string
          user_id: string
          year_founded?: number | null
        }
        Update: {
          annual_sponsorship_target?: number | null
          bio?: string | null
          commercial_manager_email?: string | null
          commercial_manager_name?: string | null
          commercial_manager_phone?: string | null
          competition_level?: Database["public"]["Enums"]["team_level"] | null
          cover_photo_url?: string | null
          created_at?: string
          discovery_ui_mode?: Database["public"]["Enums"]["ui_mode"]
          display_theme?: Database["public"]["Enums"]["display_theme"]
          fan_reach?: Database["public"]["Enums"]["fan_reach"] | null
          home_city?: string | null
          home_country?: string | null
          home_venue?: string | null
          id?: string
          logo_url?: string | null
          match_day_attendance?: number | null
          media_pack_url?: string | null
          nickname?: string | null
          notification_prefs?: Json
          offers_to_sponsors?: Json
          press_mentions?: string | null
          primary_controller_email?: string | null
          primary_controller_name?: string | null
          primary_controller_phone?: string | null
          primary_controller_role?: string | null
          seeking_sponsorship_types?: string[]
          social_accounts?: Json
          sponsorship_brief_url?: string | null
          sports?: string[]
          status?: Database["public"]["Enums"]["profile_status"]
          team_name?: string | null
          total_social_following?: number
          total_sponsorship_value_sought?: number | null
          updated_at?: string
          user_id?: string
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          cookie_prefs: Json | null
          created_at: string
          data_export_requested_at: string | null
          deactivated_at: string | null
          deletion_requested_at: string | null
          deletion_scheduled_at: string | null
          email: string
          email_verified: boolean
          id: string
          privacy_accepted_at: string | null
          privacy_version: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          role_locked_at: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          cookie_prefs?: Json | null
          created_at?: string
          data_export_requested_at?: string | null
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email: string
          email_verified?: boolean
          id: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_locked_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          cookie_prefs?: Json | null
          created_at?: string
          data_export_requested_at?: string | null
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_at?: string | null
          email?: string
          email_verified?: boolean
          id?: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_locked_at?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      participant_display: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          source_priority: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_proposal: {
        Args: { p_proposal_id: string }
        Returns: {
          additional_terms: string | null
          created_at: string
          deliverables: Json
          id: string
          match_id: string
          parent_proposal_id: string | null
          pay_amount: number
          pay_currency: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          timeline_end: string | null
          timeline_start: string | null
          title: string
          updated_at: string
          usage_rights: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_read_user_folder: { Args: { p_folder: string }; Returns: boolean }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          attempts: number
          retry_after: number
        }[]
      }
      claim_stripe_webhook_event: {
        Args: {
          p_id: string
          p_payload: Json
          p_stale_after_seconds?: number
          p_type: string
        }
        Returns: {
          attempt_count: number
          did_claim: boolean
          event_status: Database["public"]["Enums"]["stripe_webhook_event_status"]
        }[]
      }
      counter_proposal: {
        Args: {
          p_additional_terms?: string
          p_deliverables?: Json
          p_parent_proposal_id: string
          p_pay_amount: number
          p_pay_currency?: string
          p_pay_type: Database["public"]["Enums"]["pay_type"]
          p_timeline_end?: string
          p_timeline_start?: string
          p_title: string
          p_usage_rights?: Json
        }
        Returns: {
          additional_terms: string | null
          created_at: string
          deliverables: Json
          id: string
          match_id: string
          parent_proposal_id: string | null
          pay_amount: number
          pay_currency: string
          pay_type: Database["public"]["Enums"]["pay_type"]
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          timeline_end: string | null
          timeline_start: string | null
          title: string
          updated_at: string
          usage_rights: Json | null
        }
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      erase_user_data: { Args: { p_user_id: string }; Returns: Json }
      expire_listings_past_deadline: {
        Args: { p_limit?: number }
        Returns: number
      }
      get_conversations: {
        Args: { p_include_archived?: boolean }
        Returns: {
          avatar_url: string
          display_name: string
          last_message_at: string
          last_message_text: string
          last_message_type: string
          match_id: string
          match_status: string
          matched_at: string
          other_user_id: string
          unread_count: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_match_participant: { Args: { p_match_id: string }; Returns: boolean }
      is_team_owner: { Args: { p_team_id: string }; Returns: boolean }
      mark_match_read: { Args: { p_match_id: string }; Returns: string }
      process_scheduled_deletions: { Args: { p_limit?: number }; Returns: Json }
      purge_expired_rate_limits: {
        Args: { p_older_than_seconds?: number }
        Returns: number
      }
      reset_rate_limit: { Args: { p_key: string }; Returns: undefined }
    }
    Enums: {
      agent_verification_status: "unverified" | "pending" | "verified"
      athlete_level:
        | "recreational"
        | "amateur"
        | "semi_professional"
        | "professional"
        | "international"
        | "university_bucs"
        | "academy"
        | "national"
      availability_status: "available_now" | "available_from" | "not_available"
      brand_industry:
        | "sport"
        | "fashion"
        | "nutrition"
        | "technology"
        | "financial"
        | "travel"
        | "entertainment"
        | "fmcg"
        | "other"
      brand_status: "pending_approval" | "active" | "suspended" | "rejected"
      connection_status: "pending" | "accepted" | "declined" | "withdrawn"
      contract_status:
        | "draft"
        | "pending_brand_signature"
        | "pending_athlete_signature"
        | "fully_signed"
        | "terminated"
      data_export_status:
        | "pending"
        | "processing"
        | "ready"
        | "failed"
        | "expired"
      display_currency: "gbp" | "usd" | "eur"
      display_theme: "light" | "dark"
      email_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
        | "suppressed"
        | "skipped"
      email_digest: "daily" | "weekly" | "off"
      email_suppression_reason:
        | "hard_bounce"
        | "complaint"
        | "unsubscribe"
        | "manual"
      fan_reach: "local" | "regional" | "national" | "international"
      link_status: "pending" | "active" | "terminated"
      listing_status: "draft" | "active" | "paused" | "expired" | "filled"
      listing_type: "athlete_endorsement" | "team_sponsorship"
      location_precision: "city" | "region" | "country"
      match_status: "active" | "archived" | "blocked"
      message_type:
        | "text"
        | "image"
        | "video"
        | "document"
        | "proposal_card"
        | "esignature_request"
        | "payment_confirmation"
      notification_channel: "push" | "email" | "in_app"
      pay_type: "flat_fee" | "monthly_retainer" | "per_post" | "revenue_share"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
      payout_method: "bank_transfer" | "stripe_connect"
      profile_status: "draft" | "pending_review" | "active" | "deactivated"
      proposal_status:
        | "pending"
        | "accepted"
        | "declined"
        | "countered"
        | "withdrawn"
      report_reason:
        | "fake_profile"
        | "inappropriate_content"
        | "harassment"
        | "spam"
        | "underage_concern"
        | "other"
      report_status: "pending" | "under_review" | "resolved" | "dismissed"
      seeking_type:
        | "product_gifting"
        | "paid_partnership"
        | "brand_ambassador"
        | "social_content"
        | "event_appearance"
        | "affiliate_code"
        | "equipment_sponsorship"
        | "nutrition_supplement"
        | "apparel_deal"
        | "university_nil_collective"
      stripe_connect_status: "not_started" | "pending" | "restricted" | "active"
      stripe_webhook_event_status:
        | "received"
        | "processed"
        | "failed"
        | "unprocessable"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "paused"
      team_admin_invite_status: "invited" | "accepted" | "revoked"
      team_admin_role: "primary" | "standard" | "view_only"
      team_level:
        | "grassroots"
        | "college"
        | "semi_pro"
        | "professional"
        | "international"
      ui_mode: "marketplace" | "swipe"
      user_role: "athlete" | "team" | "brand" | "agent" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_verification_status: ["unverified", "pending", "verified"],
      athlete_level: [
        "recreational",
        "amateur",
        "semi_professional",
        "professional",
        "international",
        "university_bucs",
        "academy",
        "national",
      ],
      availability_status: ["available_now", "available_from", "not_available"],
      brand_industry: [
        "sport",
        "fashion",
        "nutrition",
        "technology",
        "financial",
        "travel",
        "entertainment",
        "fmcg",
        "other",
      ],
      brand_status: ["pending_approval", "active", "suspended", "rejected"],
      connection_status: ["pending", "accepted", "declined", "withdrawn"],
      contract_status: [
        "draft",
        "pending_brand_signature",
        "pending_athlete_signature",
        "fully_signed",
        "terminated",
      ],
      data_export_status: [
        "pending",
        "processing",
        "ready",
        "failed",
        "expired",
      ],
      display_currency: ["gbp", "usd", "eur"],
      display_theme: ["light", "dark"],
      email_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
        "suppressed",
        "skipped",
      ],
      email_digest: ["daily", "weekly", "off"],
      email_suppression_reason: [
        "hard_bounce",
        "complaint",
        "unsubscribe",
        "manual",
      ],
      fan_reach: ["local", "regional", "national", "international"],
      link_status: ["pending", "active", "terminated"],
      listing_status: ["draft", "active", "paused", "expired", "filled"],
      listing_type: ["athlete_endorsement", "team_sponsorship"],
      location_precision: ["city", "region", "country"],
      match_status: ["active", "archived", "blocked"],
      message_type: [
        "text",
        "image",
        "video",
        "document",
        "proposal_card",
        "esignature_request",
        "payment_confirmation",
      ],
      notification_channel: ["push", "email", "in_app"],
      pay_type: ["flat_fee", "monthly_retainer", "per_post", "revenue_share"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
      ],
      payout_method: ["bank_transfer", "stripe_connect"],
      profile_status: ["draft", "pending_review", "active", "deactivated"],
      proposal_status: [
        "pending",
        "accepted",
        "declined",
        "countered",
        "withdrawn",
      ],
      report_reason: [
        "fake_profile",
        "inappropriate_content",
        "harassment",
        "spam",
        "underage_concern",
        "other",
      ],
      report_status: ["pending", "under_review", "resolved", "dismissed"],
      seeking_type: [
        "product_gifting",
        "paid_partnership",
        "brand_ambassador",
        "social_content",
        "event_appearance",
        "affiliate_code",
        "equipment_sponsorship",
        "nutrition_supplement",
        "apparel_deal",
        "university_nil_collective",
      ],
      stripe_connect_status: ["not_started", "pending", "restricted", "active"],
      stripe_webhook_event_status: [
        "received",
        "processed",
        "failed",
        "unprocessable",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "paused",
      ],
      team_admin_invite_status: ["invited", "accepted", "revoked"],
      team_admin_role: ["primary", "standard", "view_only"],
      team_level: [
        "grassroots",
        "college",
        "semi_pro",
        "professional",
        "international",
      ],
      ui_mode: ["marketplace", "swipe"],
      user_role: ["athlete", "team", "brand", "agent", "admin"],
    },
  },
} as const
