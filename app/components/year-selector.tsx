"use client";
import {Calendar} from 'lucide-react';
import {useYear} from '@/lib/year-context';
export function YearSelector({label=true}:{label?:boolean}){
 const {year,setYear,availableYears}=useYear();
 return <span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
  {label?<Calendar size={15} aria-hidden/>:null}
  <select className="min-h-9 cursor-pointer rounded-lg border border-line bg-panel px-2.5 text-[13px] font-semibold text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand/20" value={year} onChange={event=>setYear(Number.parseInt(event.target.value,10))} aria-label="Seleccionar año fiscal">
   {availableYears.map(value=><option key={value} value={value}>{value}</option>)}
  </select>
 </span>;
}
