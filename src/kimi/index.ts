/**
 * Kimi Wire Protocol Integration
 * 
 * Экспорты для интеграции с Wire Protocol (JSON-RPC поверх stdio)
 */

export * from "./wire";
export { KimiClient } from "./kimiClient";
export * from "./wireTypes";

// HTTP API Adapter for inline editing features
export { KimiApi, KimiApiResponse, KimiApiOptions } from "./apiAdapter";
