export const EXAMPLE_SCHEMA = `
  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "posts", force: :cascade do |t|
    t.string "title"
    t.text "body"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "comments", force: :cascade do |t|
    t.text "body"
    t.bigint "user_id", null: false
    t.bigint "post_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "posts", "users"
  add_foreign_key "comments", "posts"
  add_foreign_key "comments", "users"
`;

export const SYSTEM_INSTRUCTION = `
You are an expert Ruby on Rails Database Architect. 
Your goal is to analyze database schemas (schema.rb content) provided by the user.
Provide insights on:
1. Structural integrity (circular dependencies, missing foreign keys).
2. Performance optimizations (indexes, types).
3. Naming conventions and best practices.
4. A brief summary of the domain model inferred from the tables.

Return the response in JSON format strictly conforming to this schema:
{
  "summary": "string",
  "potentialIssues": ["string", "string"],
  "suggestions": ["string", "string"]
}
`;
