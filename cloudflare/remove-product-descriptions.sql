-- Remove somente o atributo opcional "descricao" dos chaveiros no banco do
-- Catálogo PET. Preserva imagens, variações, preços, disponibilidade e ordem.
-- Idempotente: se todos já estão sem descrição, não altera a revisão.
UPDATE documents
SET content = (
  SELECT json_group_array(json_remove(value, '$.descricao'))
  FROM json_each(documents.content)
),
revision = revision + 1,
updated_at = CURRENT_TIMESTAMP
WHERE name = 'products'
  AND json_valid(content)
  AND json_type(content) = 'array'
  AND EXISTS(
    SELECT 1 FROM json_each(documents.content)
    WHERE json_type(value, '$.descricao') IS NOT NULL
  );
