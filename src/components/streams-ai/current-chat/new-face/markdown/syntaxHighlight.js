const KEYWORDS=new Set("async await break case catch class const continue default delete do else export extends false finally for from function get if implements import in instanceof interface let new null of private protected public return set static super switch this throw true try type typeof undefined var void while with yield SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE ALTER DROP INDEX JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT OFFSET AS AND OR NOT NULL PRIMARY KEY REFERENCES DEFAULT CHECK CASCADE UNIQUE WITH def elif except lambda None True False pass raise global nonlocal assert del is".split(/\s+/));
const TYPES=new Set("string number boolean unknown any never void object Record Array Promise Date Map Set React HTMLDivElement HTMLElement Node Buffer FormData Blob".split(/\s+/));
const escapeHtml=(value)=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
const span=(type,value)=>`<span class="syntaxToken syntaxToken--${type}">${escapeHtml(value)}</span>`;
function classifyWord(word,next,previous){if(KEYWORDS.has(word)||KEYWORDS.has(word.toUpperCase()))return"keyword";if(TYPES.has(word)||/^[A-Z][A-Za-z0-9_$]*$/.test(word))return"type";if(next==="(")return"function";if(previous===".")return"property";return"variable";}
export function highlightCode(raw="",language="text"){
 const source=String(raw),lang=String(language||"text").toLowerCase();let output="",index=0;
 while(index<source.length){const current=source[index],next=source[index+1];
  if(current==="/"&&next==="/"){const end=source.indexOf("\n",index),stop=end===-1?source.length:end;output+=span("comment",source.slice(index,stop));index=stop;continue;}
  if(current==="/"&&next==="*"){const end=source.indexOf("*/",index+2),stop=end===-1?source.length:end+2;output+=span("comment",source.slice(index,stop));index=stop;continue;}
  if((lang.includes("python")||lang==="py")&&current==="#"){const end=source.indexOf("\n",index),stop=end===-1?source.length:end;output+=span("comment",source.slice(index,stop));index=stop;continue;}
  if(current==="'"||current==='"'||current==="`"){const quote=current;let cursor=index+1;while(cursor<source.length){if(source[cursor]==="\\"){cursor+=2;continue;}if(source[cursor]===quote){cursor+=1;break;}cursor+=1;}output+=span("string",source.slice(index,cursor));index=cursor;continue;}
  if(/\d/.test(current)&&!/[A-Za-z_$]/.test(source[index-1]||"")){const match=source.slice(index).match(/^(?:0x[\da-f]+|0b[01]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);if(match){output+=span("number",match[0]);index+=match[0].length;continue;}}
  if(/[A-Za-z_$]/.test(current)){const match=source.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$-]*/),word=match?.[0]||current;let before=index-1;while(before>=0&&/\s/.test(source[before]))before-=1;let after=index+word.length;while(after<source.length&&/\s/.test(source[after]))after+=1;output+=span(classifyWord(word,source[after],source[before]),word);index+=word.length;continue;}
  if(/[-+*=!<>?:&|%^~]/.test(current)){const match=source.slice(index).match(/^(?:===|!==|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|\+=|-=|\*=|\/=|::|[-+*=!<>?:&|%^~])/),value=match?.[0]||current;output+=span("operator",value);index+=value.length;continue;}
  if(/[{}()[\],.;]/.test(current)){output+=span("punctuation",current);index+=1;continue;}
  output+=escapeHtml(current);index+=1;
 }
 return output;
}
