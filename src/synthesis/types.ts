/**
 * Core types for Research Synthesis Engine
 */

// ============================================================================
// Source Types
// ============================================================================

export type SourceType = 'web' | 'github' | 'arxiv' | 'community' | 'archive' | 'documentation';

export interface Source {
  id: string;
  url: string;
  title: string;
  content: string;
  snippet?: string;
  sourceType: SourceType;
  domain?: string;
  author?: string;
  publishDate?: Date;
  fetchDate: Date;
  credibilityScore: number; // 0-1
  metadata: Record<string, unknown>;
}

export interface WebSource extends Source {
  sourceType: 'web';
  searchEngine: 'duckduckgo' | 'bing' | 'google';
  rank: number;
}

export interface GitHubSource extends Source {
  sourceType: 'github';
  repo: string;
  stars: number;
  forks: number;
  language?: string;
  lastUpdated: Date;
  filePath?: string;
}

export interface ArXivSource extends Source {
  sourceType: 'arxiv';
  paperId: string;
  authors: string[];
  abstract: string;
  categories: string[];
  doi?: string;
  pdfUrl?: string;
}

export interface CommunitySource extends Source {
  sourceType: 'community';
  platform: 'hackernews' | 'reddit' | 'stackoverflow' | 'devto';
  score: number;
  comments: number;
  authorReputation?: number;
}

export interface ArchiveSource extends Source {
  sourceType: 'archive';
  originalUrl: string;
  archiveUrl: string;
  archiveDate: Date;
}

export type AnySource = WebSource | GitHubSource | ArXivSource | CommunitySource | ArchiveSource;

// ============================================================================
// Query Types
// ============================================================================

export type SearchDepth = 'quick' | 'standard' | 'comprehensive';

export interface QueryPlan {
  originalQuery: string;
  subQueries: SubQuery[];
  requiredSources: SourceType[];
  priority: 'speed' | 'balanced' | 'thoroughness';
  estimatedTime: number; // seconds
}

export interface SubQuery {
  id: string;
  query: string;
  intent: string;
  requiredSources: SourceType[];
  dependencies?: string[];
}

// ============================================================================
// Fact & Claim Types
// ============================================================================

export interface Fact {
  id: string;
  claim: string;
  type: 'statement' | 'statistic' | 'date' | 'name' | 'code' | 'quote' | 'methodology';
  sourceId: string;
  context: string; // surrounding text
  position: { start: number; end: number };
  extractedAt: Date;
  metadata: {
    numbers?: number[];
    dates?: Date[];
    entities?: string[];
    codeLanguage?: string;
  };
}

export interface StructuredClaim {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sources: string[]; // source IDs
  contradictions: string[]; // claim IDs that contradict
  supports: string[]; // claim IDs that support
}

// ============================================================================
// Cross-Reference Types
// ============================================================================

export interface CrossReference {
  id: string;
  claimId: string;
  sourceIds: string[];
  consistency: 'consistent' | 'partial' | 'contradictory';
  confidence: number;
  notes: string;
}

export interface Contradiction {
  id: string;
  claimA: string;
  claimB: string;
  sourceA: string;
  sourceB: string;
  severity: 'minor' | 'moderate' | 'major';
  resolution?: string;
  detectedAt: Date;
}

export interface Consensus {
  id: string;
  claim: string;
  sourceIds: string[];
  agreementLevel: number; // 0-1
  supportingEvidence: string[];
}

// ============================================================================
// Confidence Types
// ============================================================================

export interface ConfidenceFactors {
  sourceCount: number;
  sourceCredibility: number;
  sourceDiversity: number;
  informationFreshness: number;
  contradictionPenalty: number;
  consensusBonus: number;
}

export interface ConfidenceScore {
  overall: number; // 0-1
  factors: ConfidenceFactors;
  breakdown: {
    sourceReliability: number;
    corroboration: number;
    recency: number;
    consistency: number;
  };
  explanation: string;
}

// ============================================================================
// Citation Types
// ============================================================================

export interface Citation {
  id: string;
  number: number;
  source: Source;
  context: string;
  location?: { start: number; end: number };
}

export interface Bibliography {
  citations: Citation[];
  archivedLinks: Map<string, string>; // original URL -> archive URL
}

// ============================================================================
// Synthesis Types
// ============================================================================

export interface SynthesisOptions {
  query: string;
  sources: SourceType[];
  depth: SearchDepth;
  maxResults?: number;
  includeContradictions?: boolean;
  includeArchivedLinks?: boolean;
  citationStyle?: 'numbered' | 'inline' | 'footnote';
}

export interface SynthesisResult {
  query: string;
  outline: Outline;
  sections: Section[];
  keyTakeaways: string[];
  contradictions: Contradiction[];
  bibliography: Bibliography;
  confidence: ConfidenceScore;
  metadata: {
    sourcesUsed: number;
    totalFacts: number;
    processingTime: number;
    generatedAt: Date;
  };
}

export interface Outline {
  title: string;
  sections: OutlineSection[];
}

export interface OutlineSection {
  id: string;
  title: string;
  keyPoints: string[];
  sourceIds: string[];
  estimatedLength: number;
}

export interface Section {
  id: string;
  title: string;
  content: string; // markdown with citations
  citations: Citation[];
  confidence: number;
}

// ============================================================================
// Result Types
// ============================================================================

export interface AggregatedResults {
  sources: AnySource[];
  duplicates: Map<string, string[]>; // canonical ID -> duplicate IDs
  sourceStats: {
    byType: Record<SourceType, number>;
    total: number;
    unique: number;
  };
}

export interface SearchResult {
  sourceType: SourceType;
  query: string;
  results: AnySource[];
  error?: string;
}
