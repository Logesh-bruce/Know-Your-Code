export interface CodeFunction {
  name: string;
  description: string;
  params: string[];
  returns: string;
}

export interface CodeExplanation {
  file: string;
  summary: string;
  functions: CodeFunction[];
  relatedFiles: string[];
  deepDive?: string;
  code?: string;
}

export interface ExplainRequest {
  repoId: string;
  filePath: string;
}