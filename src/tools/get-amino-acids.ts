import type { McpServer } from '@modelcontextprotocol/server';
import { registerProfileTool } from '../profile-tool.js';

export function registerGetAminoAcids(server: McpServer): void {
  registerProfileTool(server, {
    name: 'get_amino_acids',
    title: 'Get amino acid profile of a food',
    description:
      'Amino acid profile (lysine, leucine, tryptophan, etc.) of one TACO food by id, per 100 g or scaled to grams. TACO only has it for 26 foods; others return available:false with the list of foods that do (not zero).',
    table: 'amino_acids',
    noun: 'aminoácidos',
    keysHint: '"lysine_g", "leucine_g", "tryptophan_g"'
  });
}
