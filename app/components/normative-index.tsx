"use client";

type IndexArticle = { id:string;articleNumber:string;sectionTitle:string|null;label:string|null };
export function NormativeIndex({articles,selectedId,onSelect}:{articles:IndexArticle[];selectedId?:string;onSelect:(id:string)=>void}) {
  const groups:Array<{title:string;articles:IndexArticle[]}>=[];
  for(const article of articles) {
    const title=article.sectionTitle?.trim()||"Sección no identificada";
    if(groups.at(-1)?.title!==title)groups.push({title,articles:[]});
    groups[groups.length-1].articles.push(article);
  }
  return <nav className="normativeSectionIndex" aria-label="Índice por secciones y artículos">
    <strong>Índice del documento</strong>
    <small>Títulos y capítulos registrados o extraídos de encabezados explícitos. Verifica su ubicación en el PDF.</small>
    {!articles.length?<p>Sin artículos con estos filtros.</p>:groups.map((group,index)=><details key={`${index}-${group.title}`} open={index===0||group.articles.some(article=>article.id===selectedId)}><summary>{group.title} <small>({group.articles.length})</small></summary><ol>{group.articles.map(article=><li key={article.id}><button type="button" aria-current={article.id===selectedId?"location":undefined} onClick={()=>onSelect(article.id)}><strong>Art. {article.articleNumber}</strong>{article.label?<span>{article.label}</span>:null}</button></li>)}</ol></details>)}
  </nav>;
}
