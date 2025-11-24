import { SchemaData, Table, Column, Relationship } from '../types';

export const parseSchema = (content: string): SchemaData => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  const lines = content.split('\n');

  let currentTable: Table | null = null;

  // Regex patterns
  // Matches: create_table "users", ...
  const createTableRegex = /create_table\s+"(\w+)"/;
  
  // Matches: t.string "email", ...
  const columnRegex = /t\.(\w+)\s+"(\w+)"(.*)/;
  
  // Matches: add_foreign_key "posts", "users"
  const foreignKeyRegex = /add_foreign_key\s+"(\w+)",\s+"(\w+)"/;

  // Matches implicit integer foreign keys inside table defs like t.bigint "user_id"
  // Note: This is a heuristic. Rails usually names FKs as `singular_table_name_id`.
  const implicitForeignKeyRegex = /_id"$/; 

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Check for Table Start
    const tableMatch = trimmedLine.match(createTableRegex);
    if (tableMatch) {
      currentTable = {
        id: tableMatch[1],
        columns: [],
      };
      tables.push(currentTable);
      return;
    }

    // Check for Table End
    if (trimmedLine === 'end' && currentTable) {
      currentTable = null;
      return;
    }

    // Check for Columns
    if (currentTable) {
      const colMatch = trimmedLine.match(columnRegex);
      if (colMatch) {
        const [, type, name, details] = colMatch;
        currentTable.columns.push({
          name,
          type,
          details: details ? details.trim() : undefined,
        });

        // Heuristic: If column ends in _id, it might be a relationship
        if (implicitForeignKeyRegex.test(name)) {
          const targetTableSingular = name.replace(/_id$/, '');
          // We can't be 100% sure of the pluralization without an inflector library, 
          // but we can try to find a matching table later or add a "potential" link.
          // For now, we rely on explicit add_foreign_key for strict edges, 
          // but we can try to guess simple pluralizations (s, es) if we want more edges.
          // Let's stick to explicit add_foreign_key for reliability + simple string matching
          
           // Attempt to find a table that matches standard pluralization
           const targetTablePlural = targetTableSingular + 's'; 
           // This logic happens after parsing all tables usually, but we can do a second pass.
        }
      }
    }

    // Check for Explicit Foreign Keys
    const fkMatch = trimmedLine.match(foreignKeyRegex);
    if (fkMatch) {
      relationships.push({
        source: fkMatch[1],
        target: fkMatch[2],
      });
    }
  });

  // Second Pass: Infer relationships from `t.references` or `user_id` columns if explicit keys are missing?
  // Many Rails apps don't use `add_foreign_key` explicitly in older versions.
  // Let's add relationships if we find `_id` columns that match existing table names.
  tables.forEach(sourceTable => {
    sourceTable.columns.forEach(col => {
      if (col.name.endsWith('_id')) {
        const singularName = col.name.replace(/_id$/, '');
        // Naive pluralization for matching
        const targets = [singularName + 's', singularName + 'es', singularName];
        
        const matchedTable = tables.find(t => targets.includes(t.id));
        if (matchedTable) {
          // Check if this relationship already exists (from add_foreign_key)
          const exists = relationships.some(r => r.source === sourceTable.id && r.target === matchedTable.id);
          if (!exists) {
            relationships.push({
              source: sourceTable.id,
              target: matchedTable.id,
              column: col.name
            });
          }
        }
      }
    });
  });

  return {
    tables,
    relationships,
    rawContent: content
  };
};
