
import { SchemaData, Table, Column, Relationship } from '../types';

// Helper to remove quotes
const removeQuotes = (str: string) => str.replace(/['"`]/g, '');

// --- RAILS PARSER ---
const parseRails = (content: string): SchemaData => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  const lines = content.split('\n');
  let currentTable: Table | null = null;

  const createTableRegex = /create_table\s+"(\w+)"/;
  const columnRegex = /t\.(\w+)\s+"(\w+)"(.*)/;
  const foreignKeyRegex = /add_foreign_key\s+"(\w+)",\s+"(\w+)"/;
  const implicitForeignKeyRegex = /_id"$/; 

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const tableMatch = trimmedLine.match(createTableRegex);
    if (tableMatch) {
      currentTable = { id: tableMatch[1], columns: [] };
      tables.push(currentTable);
      return;
    }
    if (trimmedLine === 'end' && currentTable) {
      currentTable = null;
      return;
    }
    if (currentTable) {
      const colMatch = trimmedLine.match(columnRegex);
      if (colMatch) {
        const [, type, name, details] = colMatch;
        currentTable.columns.push({
          name,
          type,
          details: details ? details.trim() : undefined,
        });
      }
    }
    const fkMatch = trimmedLine.match(foreignKeyRegex);
    if (fkMatch) {
      relationships.push({ source: fkMatch[1], target: fkMatch[2] });
    }
  });

  // Infer Rails implicit relationships
  tables.forEach(sourceTable => {
    sourceTable.columns.forEach(col => {
      if (col.name.endsWith('_id')) {
        const singularName = col.name.replace(/_id$/, '');
        // Rails usually pluralizes table names
        const targets = [singularName + 's', singularName + 'es', singularName];
        const matchedTable = tables.find(t => targets.includes(t.id));
        if (matchedTable) {
          const exists = relationships.some(r => r.source === sourceTable.id && r.target === matchedTable.id);
          if (!exists) {
            relationships.push({ source: sourceTable.id, target: matchedTable.id, column: col.name });
          }
        }
      }
    });
  });

  return { tables, relationships, rawContent: content };
};

// --- SQL PARSER (Generic) ---
const parseSQL = (content: string): SchemaData => {
  const tables: Table[] = [];
  const relationships: Relationship[] = [];
  
  // Normalize content: remove comments, excessive whitespace
  const cleanContent = content
    .replace(/--.*$/gm, '') // Remove single line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

  // Split by statements roughly
  const statements = cleanContent.split(';');

  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`\[])?(\w+)(?:["`\]])?/i;
  // Naive column parser: assumes "name type constraints" format
  // Matches: `id` INT PRIMARY KEY, or "id" INT ...
  const columnLineRegex = /^\s*(?:["`\[])?(\w+)(?:["`\]])?\s+([A-Z0-9_]+)(.*)$/i;
  
  const alterTableFkRegex = /ALTER\s+TABLE\s+(?:["`\[])?(\w+)(?:["`\]])?[\s\S]*?ADD\s+CONSTRAINT.*FOREIGN\s+KEY\s*\((?:["`\[])?(\w+)(?:["`\]])?\)\s*REFERENCES\s+(?:["`\[])?(\w+)(?:["`\]])?/i;
  
  // Inline FK regex: FOREIGN KEY (col) REFERENCES target(col)
  const inlineFkRegex = /FOREIGN\s+KEY\s*\((?:["`\[])?(\w+)(?:["`\]])?\)\s*REFERENCES\s+(?:["`\[])?(\w+)(?:["`\]])?/i;

  statements.forEach(statement => {
    const cleanStmt = statement.trim();
    
    // 1. CREATE TABLE
    const tableMatch = cleanStmt.match(createTableRegex);
    if (tableMatch) {
      const tableName = tableMatch[1];
      const table: Table = { id: tableName, columns: [] };
      
      // Extract the body inside parenthesis (...)
      const bodyStartIndex = cleanStmt.indexOf('(');
      const bodyEndIndex = cleanStmt.lastIndexOf(')');
      if (bodyStartIndex !== -1 && bodyEndIndex !== -1) {
        const body = cleanStmt.substring(bodyStartIndex + 1, bodyEndIndex);
        const lines = body.split(',').map(l => l.trim());
        
        lines.forEach(line => {
            // Check for inline FK
            const inlineFk = line.match(inlineFkRegex);
            if (inlineFk) {
                relationships.push({
                    source: tableName,
                    target: inlineFk[2],
                    column: inlineFk[1]
                });
                return;
            }

            // Regular column
            const colMatch = line.match(columnLineRegex);
            if (colMatch && !line.toUpperCase().startsWith('PRIMARY') && !line.toUpperCase().startsWith('FOREIGN') && !line.toUpperCase().startsWith('CONSTRAINT')) {
                table.columns.push({
                    name: colMatch[1],
                    type: colMatch[2],
                    details: colMatch[3]?.trim()
                });
            }
        });
      }
      tables.push(table);
    }

    // 2. ALTER TABLE ... ADD FOREIGN KEY
    const alterMatch = cleanStmt.match(alterTableFkRegex);
    if (alterMatch) {
        relationships.push({
            source: alterMatch[1],
            column: alterMatch[2],
            target: alterMatch[3]
        });
    }
  });

  return { tables, relationships, rawContent: content };
};

// --- PRISMA PARSER ---
const parsePrisma = (content: string): SchemaData => {
    const tables: Table[] = [];
    const relationships: Relationship[] = [];
    
    const lines = content.split('\n');
    let currentModel: Table | null = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        // model User {
        const modelMatch = trimmed.match(/^model\s+(\w+)\s+\{/);
        if (modelMatch) {
            currentModel = { id: modelMatch[1], columns: [] };
            tables.push(currentModel);
            return;
        }

        if (trimmed === '}' && currentModel) {
            currentModel = null;
            return;
        }

        if (currentModel) {
            // Field: id Int @id
            // Field: posts Post[]
            // Ignore block attributes @@
            if (trimmed.startsWith('@@') || trimmed.startsWith('//') || trimmed === '') return;

            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
                const name = parts[0];
                const type = parts[1];
                const attributes = parts.slice(2).join(' ');

                // Check if type is another model (Relation)
                // We'll resolve this after parsing all models to know which types are models
                currentModel.columns.push({
                    name,
                    type,
                    details: attributes
                });
            }
        }
    });

    // Second pass to establish relationships based on types matching model names
    const modelNames = new Set(tables.map(t => t.id));

    tables.forEach(source => {
        source.columns.forEach(col => {
            // Remove array modifiers [], ?
            // Explicitly escape brackets for regex safety
            const cleanType = col.type.replace(/[\[\]?]/g, '');
            
            if (modelNames.has(cleanType)) {
                // This is a relation field
                // In Prisma, relations are bidirectional, but graph needs one link.
                // We usually look for the @relation attribute to define the FK side, or just link them.
                
                // Avoid duplicate links: only link if source < target OR if it holds the FK
                const target = cleanType;
                
                // Check if this field holds the FK (has @relation(fields: [...]))
                const isForeignKeyHolder = col.details?.includes('@relation');
                
                if (isForeignKeyHolder) {
                     relationships.push({
                         source: source.id,
                         target: target,
                         column: col.name // This is the navigation property, actual FK col is inside @relation
                     });
                } else if (source.id < target) {
                    // Implicit/Many-to-Many fallback or just visual connection
                    // If neither side has @relation explicit, we might just draw one line
                    // But usually one side has @relation in 1:n
                }
            }
        });
    });

    return { tables, relationships, rawContent: content };
}

// --- DJANGO PARSER ---
const parseDjango = (content: string): SchemaData => {
    const tables: Table[] = [];
    const relationships: Relationship[] = [];
    
    const lines = content.split('\n');
    let currentClass: Table | null = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        // class User(models.Model): or class User(AbstractUser):
        const classMatch = trimmed.match(/^class\s+(\w+)\(.*\):/);
        
        if (classMatch) {
            currentClass = { id: classMatch[1], columns: [] };
            tables.push(currentClass);
            return;
        }

        // Indentation check would be better for python, but naive "field =" works for simple files
        if (currentClass && trimmed.includes('=')) {
            // name = models.CharField(max_length=100)
            const fieldMatch = trimmed.match(/^(\w+)\s*=\s*(models\.\w+|[a-zA-Z0-9_]+)\((.*)\)/);
            if (fieldMatch) {
                const fieldName = fieldMatch[1];
                const fieldType = fieldMatch[2];
                const args = fieldMatch[3];
                
                currentClass.columns.push({
                    name: fieldName,
                    type: fieldType,
                    details: args
                });

                // Check for Foreign Key
                if (fieldType.includes('ForeignKey') || fieldType.includes('OneToOneField') || fieldType.includes('ManyToManyField')) {
                    // Extract first arg as target model
                    // models.ForeignKey(TargetModel, ...) or 'TargetModel'
                    const targetMatch = args.match(/^(?:'|")?(\w+)(?:'|")?/);
                    if (targetMatch && targetMatch[1] !== 'self') {
                        relationships.push({
                            source: currentClass.id,
                            target: targetMatch[1],
                            column: fieldName
                        });
                    }
                }
            }
        }
    });

    return { tables, relationships, rawContent: content };
}

export const parseSchema = (content: string, filename: string = ''): SchemaData => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Heuristic detection
  if (ext === 'prisma' || content.includes('generator client {')) {
      return parsePrisma(content);
  }
  
  if (ext === 'py' || content.includes('models.Model') || content.includes('django.db')) {
      return parseDjango(content);
  }

  if (ext === 'rb' || content.includes('ActiveRecord::Schema') || content.includes('create_table')) {
      return parseRails(content);
  }

  // Fallback to SQL for .sql or generic content
  // SQL usually has CREATE TABLE
  if (ext === 'sql' || content.toUpperCase().includes('CREATE TABLE')) {
      return parseSQL(content);
  }

  // Last resort: Try Rails parser if nothing else matches (legacy behavior)
  return parseRails(content);
};
