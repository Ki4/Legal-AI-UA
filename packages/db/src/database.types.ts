export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id: string | null;
          actor_role: string | null;
          after: Json | null;
          before: Json | null;
          changed_columns: string[] | null;
          entity_id: string;
          entity_table: string;
          id: number;
          occurred_at: string;
          service_id: string | null;
        };
        Insert: {
          action: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          actor_role?: string | null;
          after?: Json | null;
          before?: Json | null;
          changed_columns?: string[] | null;
          entity_id: string;
          entity_table: string;
          id?: never;
          occurred_at?: string;
          service_id?: string | null;
        };
        Update: {
          action?: Database["public"]["Enums"]["audit_action"];
          actor_id?: string | null;
          actor_role?: string | null;
          after?: Json | null;
          before?: Json | null;
          changed_columns?: string[] | null;
          entity_id?: string;
          entity_table?: string;
          id?: never;
          occurred_at?: string;
          service_id?: string | null;
        };
        Relationships: [];
      };
      client_identities: {
        Row: {
          client_id: string;
          created_at: string;
          email: string | null;
          full_name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          email?: string | null;
          full_name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_identities_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          created_at: string;
          erased_at: string | null;
          erasure_basis: string | null;
          id: string;
          pseudonym: string;
        };
        Insert: {
          created_at?: string;
          erased_at?: string | null;
          erasure_basis?: string | null;
          id?: string;
          pseudonym?: string;
        };
        Update: {
          created_at?: string;
          erased_at?: string | null;
          erasure_basis?: string | null;
          id?: string;
          pseudonym?: string;
        };
        Relationships: [];
      };
      entitlement_services: {
        Row: {
          entitlement_id: string;
          service_id: string;
        };
        Insert: {
          entitlement_id: string;
          service_id: string;
        };
        Update: {
          entitlement_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlement_services_entitlement_id_fkey";
            columns: ["entitlement_id"];
            isOneToOne: false;
            referencedRelation: "entitlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlement_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      entitlements: {
        Row: {
          client_id: string;
          created_at: string;
          granted_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["entitlement_kind"];
          plan_code: string | null;
          revoked_at: string | null;
          valid_from: string;
          valid_until: string | null;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["entitlement_kind"];
          plan_code?: string | null;
          revoked_at?: string | null;
          valid_from?: string;
          valid_until?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          granted_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["entitlement_kind"];
          plan_code?: string | null;
          revoked_at?: string | null;
          valid_from?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["code"];
          },
        ];
      };
      orders: {
        Row: {
          client_id: string;
          closed_at: string | null;
          delivered_at: string | null;
          entitlement_id: string | null;
          human_review_requested: boolean;
          id: string;
          placed_at: string;
          reviewer_id: string | null;
          service_version_id: string;
          status: Database["public"]["Enums"]["order_status"];
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          closed_at?: string | null;
          delivered_at?: string | null;
          entitlement_id?: string | null;
          human_review_requested?: boolean;
          id?: string;
          placed_at?: string;
          reviewer_id?: string | null;
          service_version_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          closed_at?: string | null;
          delivered_at?: string | null;
          entitlement_id?: string | null;
          human_review_requested?: boolean;
          id?: string;
          placed_at?: string;
          reviewer_id?: string | null;
          service_version_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_entitlement_id_fkey";
            columns: ["entitlement_id"];
            isOneToOne: false;
            referencedRelation: "entitlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_service_version_id_fkey";
            columns: ["service_version_id"];
            isOneToOne: false;
            referencedRelation: "service_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_services: {
        Row: {
          added_at: string;
          plan_code: string;
          service_id: string;
        };
        Insert: {
          added_at?: string;
          plan_code: string;
          service_id: string;
        };
        Update: {
          added_at?: string;
          plan_code?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_services_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "plan_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          label_en: string;
          label_uk: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          label_en: string;
          label_uk: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          label_en?: string;
          label_uk?: string;
        };
        Relationships: [];
      };
      practice_areas: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          label_en: string;
          label_uk: string;
          position: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          label_en: string;
          label_uk: string;
          position: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          label_en?: string;
          label_uk?: string;
          position?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          role: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          role?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          role?: string | null;
        };
        Relationships: [];
      };
      questionnaire_fields: {
        Row: {
          created_at: string;
          field_type: Database["public"]["Enums"]["questionnaire_field_type"];
          help_text: string | null;
          id: string;
          is_personal_data: boolean;
          is_special_category: boolean;
          key: string;
          label: string;
          legal_basis: Database["public"]["Enums"]["personal_data_basis"] | null;
          options: Json | null;
          position: number;
          required: boolean;
          retention_days: number | null;
          service_id: string;
          special_category_basis: Database["public"]["Enums"]["special_category_basis"] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          field_type: Database["public"]["Enums"]["questionnaire_field_type"];
          help_text?: string | null;
          id?: string;
          is_personal_data?: boolean;
          is_special_category?: boolean;
          key: string;
          label: string;
          legal_basis?: Database["public"]["Enums"]["personal_data_basis"] | null;
          options?: Json | null;
          position?: number;
          required?: boolean;
          retention_days?: number | null;
          service_id: string;
          special_category_basis?: Database["public"]["Enums"]["special_category_basis"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          field_type?: Database["public"]["Enums"]["questionnaire_field_type"];
          help_text?: string | null;
          id?: string;
          is_personal_data?: boolean;
          is_special_category?: boolean;
          key?: string;
          label?: string;
          legal_basis?: Database["public"]["Enums"]["personal_data_basis"] | null;
          options?: Json | null;
          position?: number;
          required?: boolean;
          retention_days?: number | null;
          service_id?: string;
          special_category_basis?: Database["public"]["Enums"]["special_category_basis"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questionnaire_fields_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      service_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          is_primary: boolean;
          lawyer_id: string;
          service_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          is_primary?: boolean;
          lawyer_id: string;
          service_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          is_primary?: boolean;
          lawyer_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_assignments_lawyer_id_fkey";
            columns: ["lawyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_assignments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      service_version_prices: {
        Row: {
          amount_minor: number;
          currency: string;
          service_version_id: string;
        };
        Insert: {
          amount_minor: number;
          currency: string;
          service_version_id: string;
        };
        Update: {
          amount_minor?: number;
          currency?: string;
          service_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_version_prices_service_version_id_fkey";
            columns: ["service_version_id"];
            isOneToOne: false;
            referencedRelation: "service_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      service_versions: {
        Row: {
          created_at: string;
          generation_mode: Database["public"]["Enums"]["generation_mode"];
          id: string;
          published_at: string | null;
          published_by: string | null;
          review_mode: Database["public"]["Enums"]["review_mode"];
          service_id: string;
          status: Database["public"]["Enums"]["service_status"];
          version: number;
        };
        Insert: {
          created_at?: string;
          generation_mode: Database["public"]["Enums"]["generation_mode"];
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          review_mode: Database["public"]["Enums"]["review_mode"];
          service_id: string;
          status?: Database["public"]["Enums"]["service_status"];
          version: number;
        };
        Update: {
          created_at?: string;
          generation_mode?: Database["public"]["Enums"]["generation_mode"];
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          review_mode?: Database["public"]["Enums"]["review_mode"];
          service_id?: string;
          status?: Database["public"]["Enums"]["service_status"];
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "service_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_versions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          created_at: string;
          id: string;
          practice_area: string;
          slug: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          practice_area: string;
          slug: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          practice_area?: string;
          slug?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_practice_area_fkey";
            columns: ["practice_area"];
            isOneToOne: false;
            referencedRelation: "practice_areas";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_user: {
        Args: { new_role: string; target_user: string };
        Returns: undefined;
      };
      client_is_entitled_to: {
        Args: { target_client: string; target_service: string };
        Returns: boolean;
      };
      entitlement_covers: {
        Args: { target_entitlement: string; target_service: string };
        Returns: boolean;
      };
      erase_client: {
        Args: { basis: string; target_client: string };
        Returns: undefined;
      };
      is_assigned_to: { Args: { target_service: string }; Returns: boolean };
      is_primary_for: { Args: { target_service: string }; Returns: boolean };
      jwt_role: { Args: never; Returns: string };
      set_primary_lawyer: {
        Args: { new_lawyer: string; target_service: string };
        Returns: undefined;
      };
      version_service: { Args: { target_version: string }; Returns: string };
    };
    Enums: {
      audit_action: "insert" | "update" | "delete";
      entitlement_kind: "one_off" | "subscription";
      generation_mode: "template" | "block_assembly" | "full_generation";
      order_status:
        | "intake"
        | "submitted"
        | "generating"
        | "in_review"
        | "delivered"
        | "cancelled"
        | "abandoned";
      personal_data_basis:
        | "consent"
        | "contract"
        | "legal_obligation"
        | "vital_interests"
        | "public_task"
        | "legitimate_interests";
      questionnaire_field_type:
        "text" | "long_text" | "number" | "date" | "boolean" | "select" | "multi_select";
      review_mode: "auto" | "lawyer_required";
      service_status: "draft" | "in_review" | "published" | "paused" | "archived";
      special_category_basis:
        | "explicit_consent"
        | "employment_social_security"
        | "vital_interests"
        | "not_for_profit_body"
        | "made_public_by_subject"
        | "legal_claims"
        | "substantial_public_interest"
        | "health_care"
        | "public_health"
        | "archiving_research";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: ["insert", "update", "delete"],
      entitlement_kind: ["one_off", "subscription"],
      generation_mode: ["template", "block_assembly", "full_generation"],
      order_status: [
        "intake",
        "submitted",
        "generating",
        "in_review",
        "delivered",
        "cancelled",
        "abandoned",
      ],
      personal_data_basis: [
        "consent",
        "contract",
        "legal_obligation",
        "vital_interests",
        "public_task",
        "legitimate_interests",
      ],
      questionnaire_field_type: [
        "text",
        "long_text",
        "number",
        "date",
        "boolean",
        "select",
        "multi_select",
      ],
      review_mode: ["auto", "lawyer_required"],
      service_status: ["draft", "in_review", "published", "paused", "archived"],
      special_category_basis: [
        "explicit_consent",
        "employment_social_security",
        "vital_interests",
        "not_for_profit_body",
        "made_public_by_subject",
        "legal_claims",
        "substantial_public_interest",
        "health_care",
        "public_health",
        "archiving_research",
      ],
    },
  },
} as const;
