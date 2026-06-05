-- Operator-authored translations for public descriptions, stored as JSON maps:
--   { "Spanish": { "description": "..." }, "Vietnamese": { ... } }
ALTER TABLE facilities ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';
ALTER TABLE spaces ADD COLUMN translations TEXT NOT NULL DEFAULT '{}';

-- Demo: a Spanish version of the community description + the chapel.
UPDATE facilities SET translations =
  '{"Spanish":{"description":"Un centro comunitario del vecindario con espacios para toda ocasión: desde recepciones de boda en el Salón de Convivencia hasta talleres, recitales y comidas compartidas. Creemos que un edificio vacío es un regalo esperando ser entregado."}}'
  WHERE id = 'fac-usr-demo-operator';
UPDATE spaces SET translations =
  '{"Spanish":{"description":"Una capilla íntima con luz cálida y excelente acústica. Un entorno sereno para ceremonias pequeñas, recitales y reuniones."}}'
  WHERE id = 'spc-chapel';
