
// Defines the structure of a variable/field in the database
export interface VariableTemplate {
  id: string; // Unique immutable ID (e.g., "VAR_001")
  // name property removed as requested
  label: string; // Display label (e.g., "Systolic Blood Pressure")
  type: 'text' | 'number' | 'date' | 'select' | 'radio';
  options?: string[]; // Comma separated values for select/radio e.g. ["Yes", "No"]
  format?: string;    // e.g. "YYYY-MM-DD" or "Decimal(2)"
}

// Defines a Form (CRF) which contains variables
export interface FormTemplate {
  id: string; // e.g., "FORM_VITALS"
  name: string; // e.g., "Vital Signs"
  type: 'standard' | 'grid'; // 'standard' = flat list, 'grid' = matrix (rows x cols)
  defaultRows?: string[]; // For grid types: default row labels (e.g., "Pre-dose", "1h")
  variableIds: string[]; // References to VariableTemplate IDs (Columns in grid, or all vars in standard)
  headerVariableIds?: string[]; // For grid types: Common variables displayed above the grid (e.g., "Date")
}

// The entire "Database" or "Library"
export interface LibraryData {
  // Visits are no longer part of the library, they are specific to the project/protocol
  forms: FormTemplate[];
  variables: VariableTemplate[];
}

// --- NEW SIMPLE LOGIC TYPES ---
export interface VariableLogic {
  triggerId: string; // The ID of the variable controlling this one (must be in same form)
  triggerValue: string; // The value that activates this variable
}

// The actual structure the user builds (selected items)
export interface ProjectNode {
  visitId: string;
  visitName: string; // Stored directly on the node now
  order: number; // To maintain sequence
  forms: ProjectFormNode[];
}

export interface ProjectFormNode {
  instanceId: string; // Unique ID for this instance in the project
  formId: string; // Link to Library Form ID
  customFormName?: string; // Allow user to override the form name instance-specific
  rows?: string[]; // For grid types: specific rows for this instance
  variables: ProjectVariableNode[];
  // logicRules removed in favor of inline logic
}

export interface ProjectVariableNode {
  variableId: string; // Link to Library Variable ID
  customLabel: string; // Allow user to override the default label
  customOptions?: string[]; // Allow overriding options instance-specific
  customFormat?: string;    // Allow overriding format instance-specific
  logic?: VariableLogic;    // New: Inline simple logic
  included: boolean; // Whether this field is selected for export
}

// Snapshot of a project state
export interface ProjectVersion {
  versionName: string;
  timestamp: number;
  project: ProjectNode[];
  library: LibraryData; // Need to save library too as custom forms might change
}

// --- NEW TYPES FOR MULTI-PROJECT MANAGEMENT ---

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  lastModified: number;
}

export interface ProjectFile {
  meta: ProjectMeta;
  data: {
    project: ProjectNode[];
    library: LibraryData;
    versions: ProjectVersion[];
  }
}
