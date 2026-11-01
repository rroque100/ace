import {Bot,LoaderCircle,FileText} from 'lucide-react';
import {responseAiIdentity} from '@/lib/response-ai-identity';
export function ResponseAiBadge({model,provider,streaming,error}:{model?:string;provider?:string;streaming?:boolean;error?:string}){
 const identity=responseAiIdentity({model,provider,streaming,error});
 const Icon=identity.kind==='pending'?LoaderCircle:identity.kind==='system'?FileText:Bot;
 return <div className="chatResponseAi" data-state={identity.kind} title={identity.note} aria-label={`IA de esta respuesta: ${identity.provider}${identity.model?` · ${identity.model}`:''}`}>
   <Icon size={14} aria-hidden className={identity.kind==='pending'?'chatResponseAiSpinner':undefined}/>
   <span>{identity.kind==='confirmed'?'Respondió':'Estado'}: <strong>{identity.provider}</strong></span>
   {identity.model?<span className="chatResponseAiModel">{identity.model}</span>:null}
   {identity.kind==='pending'?<span className="chatResponseAiNote">Proveedor por confirmar</span>:null}
 </div>;
}
