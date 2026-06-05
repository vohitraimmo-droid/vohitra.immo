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
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          cover_url: string | null
          created_at: string
          excerpt: string
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cgu: {
        Row: {
          content_fr: string
          content_mg: string
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_fr?: string
          content_mg?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_fr?: string
          content_mg?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contact_unlocks: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_unlocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_requests: {
        Row: {
          cin_recto_url: string
          cin_verso_url: string
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reject_reason: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          cin_recto_url: string
          cin_verso_url: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          cin_recto_url?: string
          cin_verso_url?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          property_id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          property_id: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          property_id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      owner_reviews: {
        Row: {
          author_id: string
          comment: string | null
          created_at: string
          id: string
          owner_id: string
          property_id: string | null
          rating: number
          updated_at: string
        }
        Insert: {
          author_id: string
          comment?: string | null
          created_at?: string
          id?: string
          owner_id: string
          property_id?: string | null
          rating: number
          updated_at?: string
        }
        Update: {
          author_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          property_id?: string | null
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string | null
          tokens_balance: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          tokens_balance?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string | null
          tokens_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          city: string
          created_at: string
          description: string
          id: string
          is_premium: boolean
          is_verified: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          owner_id: string
          postal_code: string | null
          premium_until: string | null
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"]
          surface: number
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          description?: string
          id?: string
          is_premium?: boolean
          is_verified?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          owner_id: string
          postal_code?: string | null
          premium_until?: string | null
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          surface: number
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          description?: string
          id?: string
          is_premium?: boolean
          is_verified?: boolean
          listing_type?: Database["public"]["Enums"]["listing_type"]
          owner_id?: string
          postal_code?: string | null
          premium_until?: string | null
          price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          surface?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_contacts: {
        Row: {
          created_at: string
          property_id: string
          updated_at: string
          visit_phone: string
        }
        Insert: {
          created_at?: string
          property_id: string
          updated_at?: string
          visit_phone: string
        }
        Update: {
          created_at?: string
          property_id?: string
          updated_at?: string
          visit_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          property_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_reports: {
        Row: {
          admin_note: string | null
          created_at: string
          details: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          property_id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          property_id: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          details?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          property_id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: []
      }
      property_views: {
        Row: {
          created_at: string
          id: string
          property_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          viewer_id?: string | null
        }
        Relationships: []
      }
      search_alerts: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          last_notified_at: string | null
          listing_type: string | null
          name: string
          price_max: number | null
          property_type: string | null
          q: string | null
          rooms_min: number | null
          surface_min: number | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          listing_type?: string | null
          name: string
          price_max?: number | null
          property_type?: string | null
          q?: string | null
          rooms_min?: number | null
          surface_min?: number | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_notified_at?: string | null
          listing_type?: string | null
          name?: string
          price_max?: number | null
          property_type?: string | null
          q?: string | null
          rooms_min?: number | null
          surface_min?: number | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          boost_long_enabled: boolean
          boost_short_days: number
          boost_short_enabled: boolean
          boost_short_tokens: number
          free_mode_until: string | null
          free_unlocks_per_day: number
          hero_background_url: string | null
          hero_subtitle: string
          hero_title: string
          id: number
          logo_url: string | null
          premium_enabled: boolean
          primary_color: string
          pro_subscription_days: number
          pro_subscription_tokens: number
          purchase_instructions: string
          secondary_color: string
          site_name: string
          token_price: number
          unlock_cost_tokens: number
          unlock_tokens_enabled: boolean
          updated_at: string
          verification_cost_tokens: number
        }
        Insert: {
          boost_long_enabled?: boolean
          boost_short_days?: number
          boost_short_enabled?: boolean
          boost_short_tokens?: number
          free_mode_until?: string | null
          free_unlocks_per_day?: number
          hero_background_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          id?: number
          logo_url?: string | null
          premium_enabled?: boolean
          primary_color?: string
          pro_subscription_days?: number
          pro_subscription_tokens?: number
          purchase_instructions?: string
          secondary_color?: string
          site_name?: string
          token_price?: number
          unlock_cost_tokens?: number
          unlock_tokens_enabled?: boolean
          updated_at?: string
          verification_cost_tokens?: number
        }
        Update: {
          boost_long_enabled?: boolean
          boost_short_days?: number
          boost_short_enabled?: boolean
          boost_short_tokens?: number
          free_mode_until?: string | null
          free_unlocks_per_day?: number
          hero_background_url?: string | null
          hero_subtitle?: string
          hero_title?: string
          id?: number
          logo_url?: string | null
          premium_enabled?: boolean
          primary_color?: string
          pro_subscription_days?: number
          pro_subscription_tokens?: number
          purchase_instructions?: string
          secondary_color?: string
          site_name?: string
          token_price?: number
          unlock_cost_tokens?: number
          unlock_tokens_enabled?: boolean
          updated_at?: string
          verification_cost_tokens?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          active_until: string
          created_at: string
          id: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_until: string
          created_at?: string
          id?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_until?: string
          created_at?: string
          id?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      token_purchase_requests: {
        Row: {
          created_at: string
          id: string
          payment_reference: string | null
          processed_at: string | null
          processed_by: string | null
          reject_reason: string | null
          status: Database["public"]["Enums"]["request_status"]
          tokens_amount: number
          total_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tokens_amount: number
          total_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_reference?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tokens_amount?: number
          total_price?: number
          user_id?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          active: boolean
          banned_by: string | null
          banned_until: string | null
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          active?: boolean
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          active?: boolean
          banned_by?: string | null
          banned_until?: string | null
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          property_id: string
          reject_reason: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          property_id: string
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          property_id?: string
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_bookings: {
        Row: {
          created_at: string
          id: string
          property_id: string
          slot_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          slot_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          slot_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "visit_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_slots: {
        Row: {
          created_at: string
          id: string
          is_booked: boolean
          property_id: string
          slot_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_booked?: boolean
          property_id: string
          slot_at: string
        }
        Update: {
          created_at?: string
          id?: string
          is_booked?: boolean
          property_id?: string
          slot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_slots_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_active_users: { Args: { since: string }; Returns: number }
      credit_tokens: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      debit_tokens: {
        Args: { _cost: number; _reason: string; _user_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_unconfirmed_users: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_visit_phone: { Args: { _property_id: string }; Returns: string }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "locataire" | "proprietaire" | "admin"
      kyc_status: "none" | "pending" | "approved" | "rejected"
      listing_type: "rent" | "sale"
      property_status: "active" | "inactive" | "pending"
      property_type: "appartement" | "maison" | "local_commercial" | "terrain"
      report_status: "pending" | "reviewed" | "dismissed" | "removed"
      request_status: "pending" | "approved" | "rejected"
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
  public: {
    Enums: {
      app_role: ["locataire", "proprietaire", "admin"],
      kyc_status: ["none", "pending", "approved", "rejected"],
      listing_type: ["rent", "sale"],
      property_status: ["active", "inactive", "pending"],
      property_type: ["appartement", "maison", "local_commercial", "terrain"],
      report_status: ["pending", "reviewed", "dismissed", "removed"],
      request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
