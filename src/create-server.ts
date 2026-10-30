import { McpServer } from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { registerCalcMeal } from './tools/calc-meal.js';
import { registerConvertHouseholdMeasure } from './tools/convert-household-measure.js';
import { registerCompareFoods } from './tools/compare-foods.js';
import { registerGetNutrients } from './tools/get-nutrients.js';
import { registerPing } from './tools/ping.js';
import { registerSearchFood } from './tools/search-food.js';

export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerPing(server);
  registerSearchFood(server);
  registerGetNutrients(server);
  registerCalcMeal(server);
  registerCompareFoods(server);
  registerConvertHouseholdMeasure(server);
  return server;
}
