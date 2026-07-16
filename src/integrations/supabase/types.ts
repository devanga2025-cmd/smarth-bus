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
      app_versions: {
        Row: {
          created_at: string
          download_url: string | null
          id: string
          is_active: boolean
          mandatory: boolean
          platform: string
          release_notes: string | null
          version_code: number
          version_name: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_active?: boolean
          mandatory?: boolean
          platform?: string
          release_notes?: string | null
          version_code: number
          version_name: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_active?: boolean
          mandatory?: boolean
          platform?: string
          release_notes?: string | null
          version_code?: number
          version_name?: string
        }
        Relationships: []
      }
      bus_driver_assignments: {
        Row: {
          assigned_at: string
          bus_id: string
          driver_id: string
          id: string
          is_active: boolean
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          bus_id: string
          driver_id: string
          id?: string
          is_active?: boolean
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          bus_id?: string
          driver_id?: string
          id?: string
          is_active?: boolean
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_driver_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_name: string
          bus_number: string
          bus_type: string | null
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          registration_number: string
          status: Database["public"]["Enums"]["bus_status"]
          updated_at: string
        }
        Insert: {
          bus_name: string
          bus_number: string
          bus_type?: string | null
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          registration_number: string
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Update: {
          bus_name?: string
          bus_number?: string
          bus_type?: string | null
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          registration_number?: string
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          bus_id: string
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          bus_id: string
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          bus_id?: string
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_login_attempts: {
        Row: {
          attempted_at: string
          attempted_login_name: string
          driver_id: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          attempted_login_name: string
          driver_id?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          attempted_login_name?: string
          driver_id?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_login_attempts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_sessions: {
        Row: {
          created_at: string
          device_id: string | null
          driver_id: string
          expires_at: string
          id: string
          ip_address: string | null
          last_active_at: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          driver_id: string
          expires_at: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          driver_id?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          last_active_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_sessions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          created_at: string
          failed_login_attempts: number
          id: string
          is_active: boolean
          licence_expiry: string | null
          licence_number: string
          locked_until: string | null
          login_name: string
          name: string
          phone: string
          pin_hash: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          licence_expiry?: string | null
          licence_number: string
          locked_until?: string | null
          login_name: string
          name: string
          phone: string
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          failed_login_attempts?: number
          id?: string
          is_active?: boolean
          licence_expiry?: string | null
          licence_number?: string
          locked_until?: string | null
          login_name?: string
          name?: string
          phone?: string
          pin_hash?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          distance_from_route_start: number | null
          expected_arrival_offset: number | null
          id: string
          route_id: string
          stop_id: string
          stop_order: number
        }
        Insert: {
          distance_from_route_start?: number | null
          expected_arrival_offset?: number | null
          id?: string
          route_id: string
          stop_id: string
          stop_order: number
        }
        Update: {
          distance_from_route_start?: number | null
          expected_arrival_offset?: number | null
          id?: string
          route_id?: string
          stop_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          end_stop_id: string | null
          estimated_duration: number | null
          id: string
          is_active: boolean
          route_geometry: Json | null
          route_name: string
          start_stop_id: string | null
          total_distance: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_stop_id?: string | null
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          route_geometry?: Json | null
          route_name: string
          start_stop_id?: string | null
          total_distance?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_stop_id?: string | null
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          route_geometry?: Json | null
          route_name?: string
          start_stop_id?: string | null
          total_distance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_end_stop_id_fkey"
            columns: ["end_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_start_stop_id_fkey"
            columns: ["start_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          stop_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          stop_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          stop_name?: string
        }
        Relationships: []
      }
      trip_stop_status: {
        Row: {
          actual_arrival_time: string | null
          expected_arrival_time: string | null
          id: string
          status: string
          stop_id: string
          stop_order: number
          trip_id: string
        }
        Insert: {
          actual_arrival_time?: string | null
          expected_arrival_time?: string | null
          id?: string
          status?: string
          stop_id: string
          stop_order: number
          trip_id: string
        }
        Update: {
          actual_arrival_time?: string | null
          expected_arrival_time?: string | null
          id?: string
          status?: string
          stop_id?: string
          stop_order?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stop_status_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stop_status_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          bus_id: string
          created_at: string
          current_stop_id: string | null
          delay_minutes: number | null
          driver_id: string
          expected_end_time: string | null
          id: string
          next_stop_id: string | null
          route_id: string
          scheduled_start_time: string
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          bus_id: string
          created_at?: string
          current_stop_id?: string | null
          delay_minutes?: number | null
          driver_id: string
          expected_end_time?: string | null
          id?: string
          next_stop_id?: string | null
          route_id: string
          scheduled_start_time: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          bus_id?: string
          created_at?: string
          current_stop_id?: string | null
          delay_minutes?: number | null
          driver_id?: string
          expected_end_time?: string | null
          id?: string
          next_stop_id?: string | null
          route_id?: string
          scheduled_start_time?: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_current_stop_id_fkey"
            columns: ["current_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_next_stop_id_fkey"
            columns: ["next_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      bus_status:
        | "available"
        | "assigned"
        | "running"
        | "offline"
        | "maintenance"
      driver_status: "available" | "assigned" | "on_trip" | "offline"
      trip_status:
        | "scheduled"
        | "active"
        | "delayed"
        | "completed"
        | "cancelled"
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
      bus_status: [
        "available",
        "assigned",
        "running",
        "offline",
        "maintenance",
      ],
      driver_status: ["available", "assigned", "on_trip", "offline"],
      trip_status: ["scheduled", "active", "delayed", "completed", "cancelled"],
    },
  },
} as const
