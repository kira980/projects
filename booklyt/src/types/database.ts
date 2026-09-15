export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          category: string
          phone: string | null
          address: string | null
          logo_url: string | null
          description: string | null
          app_name: string | null
          app_icon_url: string | null
          admin_password_hash: string | null
          admin_password_salt: string | null
          admin_password_updated_at: string | null
          appointments_require_confirmation: boolean
          customer_confirmation_enabled: boolean
          time_format: string
          language: 'en' | 'ar'
          currency: string
          booking_mode: 'appointment' | 'group'
          group_capacity: number
          slot_interval: number
          booking_verification_method: 'otp' | 'link' | 'none'
          timezone: string
          wa_booking_confirmation: boolean
          wa_reminders: boolean
          wa_waitlist: boolean
          active: boolean
          booking_days_ahead: number | null
          business_code: string | null
          app_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          category: string
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          description?: string | null
          app_name?: string | null
          app_icon_url?: string | null
          admin_password_hash?: string | null
          admin_password_salt?: string | null
          admin_password_updated_at?: string | null
          appointments_require_confirmation?: boolean
          customer_confirmation_enabled?: boolean
          time_format?: string
          language?: 'en' | 'ar'
          currency?: string
          booking_mode?: 'appointment' | 'group'
          group_capacity?: number
          booking_verification_method?: 'otp' | 'link' | 'none'
          timezone?: string
          wa_booking_confirmation?: boolean
          wa_reminders?: boolean
          wa_waitlist?: boolean
          active?: boolean
          booking_days_ahead?: number | null
          business_code?: string | null
          app_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          category?: string
          phone?: string | null
          address?: string | null
          logo_url?: string | null
          description?: string | null
          app_name?: string | null
          app_icon_url?: string | null
          admin_password_hash?: string | null
          admin_password_salt?: string | null
          admin_password_updated_at?: string | null
          appointments_require_confirmation?: boolean
          customer_confirmation_enabled?: boolean
          time_format?: string
          language?: 'en' | 'ar'
          currency?: string
          booking_mode?: 'appointment' | 'group'
          group_capacity?: number
          booking_verification_method?: 'otp' | 'link' | 'none'
          timezone?: string
          wa_booking_confirmation?: boolean
          wa_reminders?: boolean
          wa_waitlist?: boolean
          active?: boolean
          booking_days_ahead?: number | null
          business_code?: string | null
          app_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          business_id: string
          category_id: string | null
          name: string
          description: string | null
          price: number
          duration_minutes: number
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          category_id?: string | null
          name: string
          description?: string | null
          price?: number
          duration_minutes?: number
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          name?: string
          description?: string | null
          price?: number
          duration_minutes?: number
          image_url?: string | null
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          id: string
          business_id: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff_services: {
        Row: {
          staff_member_id: string
          service_id: string
          created_at: string
        }
        Insert: {
          staff_member_id: string
          service_id: string
          created_at?: string
        }
        Update: {
          staff_member_id?: string
          service_id?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          id: string
          business_id: string
          name: string
          role: string | null
          avatar_url: string | null
          bio: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          role?: string | null
          avatar_url?: string | null
          bio?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          role?: string | null
          avatar_url?: string | null
          bio?: string | null
          active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          id: string
          business_id: string
          day_of_week: number
          is_open: boolean
          open_time: string | null
          close_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          day_of_week: number
          is_open?: boolean
          open_time?: string | null
          close_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          is_open?: boolean
          open_time?: string | null
          close_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      working_hour_breaks: {
        Row: {
          id: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          start_time?: string
          end_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          business_id: string
          name: string
          phone: string | null
          email: string | null
          customer_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          phone?: string | null
          email?: string | null
          customer_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          phone?: string | null
          email?: string | null
          customer_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_users: {
        Row: {
          id: string
          phone: string
          password_hash: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          password_hash: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_user_sessions: {
        Row: {
          id: string
          customer_user_id: string
          token_hash: string
          user_agent: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_user_id: string
          token_hash: string
          user_agent?: string | null
          expires_at: string
          created_at?: string
        }
        Update: {
          expires_at?: string
        }
        Relationships: []
      }
      customer_sessions: {
        Row: {
          id: string
          business_id: string
          customer_id: string
          token_hash: string
          user_agent: string | null
          last_seen_at: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          customer_id: string
          token_hash: string
          user_agent?: string | null
          last_seen_at?: string
          expires_at: string
          created_at?: string
        }
        Update: {
          user_agent?: string | null
          last_seen_at?: string
          expires_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          business_id: string
          service_id: string
          staff_member_id: string | null
          customer_id: string | null
          customer_user_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_email: string | null
          appointment_date: string
          start_time: string
          end_time: string
          participants_count: number
          manage_token: string | null
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          cancelled_at: string | null
          customer_confirmed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          service_id: string
          staff_member_id?: string | null
          customer_id?: string | null
          customer_user_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_email?: string | null
          appointment_date: string
          start_time: string
          end_time: string
          participants_count?: number
          manage_token?: string | null
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          cancelled_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          participants_count?: number
          manage_token?: string | null
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
          cancelled_at?: string | null
          customer_confirmed_at?: string | null
          notes?: string | null
          customer_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          id: string
          business_id: string
          service_id: string
          staff_member_id: string | null
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          preferred_date: string
          preferred_eras: string[]
          participants_count: number
          status: 'active' | 'notified' | 'booked' | 'cancelled'
          notify_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          service_id: string
          staff_member_id?: string | null
          customer_name: string
          customer_email?: string | null
          customer_phone?: string | null
          preferred_date: string
          preferred_eras?: string[]
          participants_count?: number
          status?: 'active' | 'notified' | 'booked' | 'cancelled'
          notify_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          staff_member_id?: string | null
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string | null
          preferred_date?: string
          preferred_eras?: string[]
          participants_count?: number
          status?: 'active' | 'notified' | 'booked' | 'cancelled'
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          business_id: string | null
          appointment_id: string | null
          waitlist_entry_id: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id?: string | null
          appointment_id?: string | null
          waitlist_entry_id?: string | null
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          appointment_id?: string | null
          waitlist_entry_id?: string | null
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_events: {
        Row: {
          id: string
          business_id: string
          appointment_id: string | null
          event_type: 'reservation' | 'cancellation' | 'status_change' | 'reschedule' | 'note'
          title: string
          description: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          appointment_id?: string | null
          event_type: 'reservation' | 'cancellation' | 'status_change' | 'reschedule' | 'note'
          title: string
          description?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      tenant_experience_configs: {
        Row: {
          id: string
          business_id: string
          brand_json: Json
          layout_json: Json
          content_json: Json
          meta_json: Json
          published_config_json: Json | null
          draft_config_json: Json | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          brand_json?: Json
          layout_json?: Json
          content_json?: Json
          meta_json?: Json
          published_config_json?: Json | null
          draft_config_json?: Json | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_json?: Json
          layout_json?: Json
          content_json?: Json
          meta_json?: Json
          published_config_json?: Json | null
          draft_config_json?: Json | null
          is_published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      customer_businesses: {
        Row: {
          id: string
          customer_user_id: string
          business_id: string
          first_visited_at: string
          last_visited_at: string
          visit_count: number
          favorite: boolean
          notifications_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          customer_user_id: string
          business_id: string
          first_visited_at?: string
          last_visited_at?: string
          visit_count?: number
          favorite?: boolean
          notifications_enabled?: boolean
          created_at?: string
        }
        Update: {
          last_visited_at?: string
          visit_count?: number
          favorite?: boolean
          notifications_enabled?: boolean
        }
        Relationships: []
      }
      customer_devices: {
        Row: {
          id: string
          customer_user_id: string
          platform: 'ios' | 'android' | 'web'
          push_token: string
          notification_permission: 'granted' | 'denied' | 'prompt'
          last_seen: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_user_id: string
          platform: 'ios' | 'android' | 'web'
          push_token: string
          notification_permission?: 'granted' | 'denied' | 'prompt'
          last_seen?: string
          created_at?: string
        }
        Update: {
          platform?: 'ios' | 'android' | 'web'
          push_token?: string
          notification_permission?: 'granted' | 'denied' | 'prompt'
          last_seen?: string
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          id: string
          customer_user_id: string
          business_id: string | null
          type: 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'booking_changed' | 'waitlist' | 'announcement' | 'rebooking'
          title: string
          body: string
          url: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_user_id: string
          business_id?: string | null
          type: 'booking_confirmed' | 'booking_reminder' | 'booking_cancelled' | 'booking_changed' | 'waitlist' | 'announcement' | 'rebooking'
          title: string
          body: string
          url?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
      business_announcements: {
        Row: {
          id: string
          business_id: string
          title: string
          body: string
          sent_at: string | null
          recipient_count: number | null
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          title: string
          body: string
          sent_at?: string | null
          recipient_count?: number | null
          created_at?: string
        }
        Update: {
          sent_at?: string | null
          recipient_count?: number | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      ensure_profile: {
        Args: { p_full_name?: string | null }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Business = Database['public']['Tables']['businesses']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row']
export type StaffService = Database['public']['Tables']['staff_services']['Row']
export type StaffMember = Database['public']['Tables']['staff_members']['Row']
export type WorkingHours = Database['public']['Tables']['working_hours']['Row']
export type WorkingHourBreak = Database['public']['Tables']['working_hour_breaks']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerSession = Database['public']['Tables']['customer_sessions']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type AppointmentEvent = Database['public']['Tables']['appointment_events']['Row']
export type WaitlistEntry = Database['public']['Tables']['waitlist_entries']['Row']
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type CustomerBusiness = Database['public']['Tables']['customer_businesses']['Row']
export type CustomerDevice = Database['public']['Tables']['customer_devices']['Row']
export type CustomerNotification = Database['public']['Tables']['customer_notifications']['Row']
export type BusinessAnnouncement = Database['public']['Tables']['business_announcements']['Row']

export type AppointmentWithRelations = Appointment & {
  services?: Pick<Service, 'id' | 'name' | 'duration_minutes' | 'price'>
  staff_members?: Pick<StaffMember, 'id' | 'name' | 'role' | 'avatar_url'> | null
}
