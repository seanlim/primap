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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          late_cancel_hours: number
          required_walks_per_round: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          late_cancel_hours?: number
          required_walks_per_round?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          late_cancel_hours?: number
          required_walks_per_round?: number
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          created_at: string
          description: string
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          lat: number | null
          lng: number | null
          reported_by: string
          resolved: boolean
          resolved_notes: string | null
          slot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          lat?: number | null
          lng?: number | null
          reported_by: string
          resolved?: boolean
          resolved_notes?: string | null
          slot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          lat?: number | null
          lng?: number | null
          reported_by?: string
          resolved?: boolean
          resolved_notes?: string | null
          slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "walk_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          exif_datetime: string | null
          exif_lat: number | null
          exif_lng: number | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          observation_id: string | null
          sighting_id: string | null
        }
        Insert: {
          created_at?: string
          exif_datetime?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          observation_id?: string | null
          sighting_id?: string | null
        }
        Update: {
          created_at?: string
          exif_datetime?: string | null
          exif_lat?: number | null
          exif_lng?: number | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          observation_id?: string | null
          sighting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_sighting_id_fkey"
            columns: ["sighting_id"]
            isOneToOne: false
            referencedRelation: "sightings"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          client_draft_id: string | null
          created_at: string
          id: string
          last_user_agent: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          outcome: Database["public"]["Enums"]["observation_outcome"]
          slot_id: string
          status: Database["public"]["Enums"]["observation_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          walk_completion: Database["public"]["Enums"]["walk_completion"]
        }
        Insert: {
          client_draft_id?: string | null
          created_at?: string
          id?: string
          last_user_agent?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["observation_outcome"]
          slot_id: string
          status?: Database["public"]["Enums"]["observation_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          walk_completion?: Database["public"]["Enums"]["walk_completion"]
        }
        Update: {
          client_draft_id?: string | null
          created_at?: string
          id?: string
          last_user_agent?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["observation_outcome"]
          slot_id?: string
          status?: Database["public"]["Enums"]["observation_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          walk_completion?: Database["public"]["Enums"]["walk_completion"]
        }
        Relationships: [
          {
            foreignKeyName: "observations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "walk_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      sightings: {
        Row: {
          count: string
          created_at: string
          id: string
          lat: number
          lng: number
          notes: string | null
          observation_id: string
          observed_at: string | null
          species: Database["public"]["Enums"]["species_type"]
          species_other: string | null
        }
        Insert: {
          count?: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          notes?: string | null
          observation_id: string
          observed_at?: string | null
          species: Database["public"]["Enums"]["species_type"]
          species_other?: string | null
        }
        Update: {
          count?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          notes?: string | null
          observation_id?: string
          observed_at?: string | null
          species?: Database["public"]["Enums"]["species_type"]
          species_other?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sightings_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_memberships: {
        Row: {
          cancelled_at: string | null
          id: string
          joined_at: string
          slot_id: string
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          id?: string
          joined_at?: string
          slot_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          id?: string
          joined_at?: string
          slot_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_memberships_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "walk_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_rounds: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["round_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["round_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_slots: {
        Row: {
          created_at: string
          end_time: string
          id: string
          location_name: string
          max_volunteers: number
          round_id: string
          start_time: string
          updated_at: string
          walk_date: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          location_name: string
          max_volunteers?: number
          round_id: string
          start_time: string
          updated_at?: string
          walk_date: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          location_name?: string
          max_volunteers?: number
          round_id?: string
          start_time?: string
          updated_at?: string
          walk_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_slots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "survey_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      join_slot_with_observation: {
        Args: { p_slot_id: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      incident_type:
        | "INJURED_ANIMAL"
        | "DEAD_ANIMAL"
        | "HUMAN_WILDLIFE_CONFLICT"
        | "HABITAT_DAMAGE"
        | "OTHER"
      media_type: "PHOTO" | "VIDEO"
      membership_status: "ACTIVE" | "CANCELLED"
      observation_outcome: "SIGHTED" | "NOT_SIGHTED"
      observation_status: "DRAFT" | "SUBMITTED"
      round_status: "DRAFT" | "OPEN" | "CLOSED"
      species_type: "RBL" | "LTM" | "DUSKY" | "OTHER"
      user_role: "ADMIN" | "VOLUNTEER"
      user_status: "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED"
      walk_completion: "COMPLETED" | "PARTIAL" | "ABORTED"
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
      incident_type: [
        "INJURED_ANIMAL",
        "DEAD_ANIMAL",
        "HUMAN_WILDLIFE_CONFLICT",
        "HABITAT_DAMAGE",
        "OTHER",
      ],
      media_type: ["PHOTO", "VIDEO"],
      membership_status: ["ACTIVE", "CANCELLED"],
      observation_outcome: ["SIGHTED", "NOT_SIGHTED"],
      observation_status: ["DRAFT", "SUBMITTED"],
      round_status: ["DRAFT", "OPEN", "CLOSED"],
      species_type: ["RBL", "LTM", "DUSKY", "OTHER"],
      user_role: ["ADMIN", "VOLUNTEER"],
      user_status: ["PENDING", "ACTIVE", "REJECTED", "DISABLED"],
      walk_completion: ["COMPLETED", "PARTIAL", "ABORTED"],
    },
  },
} as const
