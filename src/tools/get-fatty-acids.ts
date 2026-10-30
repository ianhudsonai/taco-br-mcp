import type { McpServer } from '@modelcontextprotocol/server';
import { registerProfileTool } from '../profile-tool.js';

export function registerGetFattyAcids(server: McpServer): void {
  registerProfileTool(server, {
    name: 'get_fatty_acids',
    title: 'Get fatty acid profile of a food',
    description:
      'Fatty acid profile (saturated, mono/polyunsaturated, omega-3/6, EPA, DHA, trans, and individual acids) of one TACO food by id, per 100 g or scaled to grams. Only 423 of 597 foods have it; others return available:false (not zero). Tr is {"trace":true}, missing is null.',
    table: 'fatty_acids',
    noun: 'ácidos graxos',
    keysHint: '"saturated_g", "dha_c22_6_g", "c18_3_n3_g"'
  });
}
