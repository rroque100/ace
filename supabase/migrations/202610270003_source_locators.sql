begin;
-- Keep the existing ranking and article pagination; only add recorded block locators to results.
do $$ declare fn record; definition text; alias text; begin
 for fn in select oid from pg_proc where pronamespace='public'::regnamespace and proname in('ace_search_documents_page_v2','ace_search_document_matches_v2','ace_literal_document_search_v1') loop
  definition:=pg_get_functiondef(fn.oid);
  if position('''locatorLabel''' in definition)=0 then
   foreach alias in array array['x','c','h'] loop
    definition:=replace(definition,format('''article'',%s.metadata->>''article''',alias),format('''article'',%1$s.metadata->>''article'',''locator'',%1$s.metadata->>''locator'',''locatorLabel'',%1$s.metadata->>''locatorLabel''',alias));
   end loop;
   execute definition;
  end if;
 end loop;
end $$;
commit;
