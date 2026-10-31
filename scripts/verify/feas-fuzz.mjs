import {writeFileSync} from 'node:fs';
const {feasibility,sensitivity}=await import('../../public/js/feasibility.js');
let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const pick=(a,b,blank=0.1)=>rnd()<blank?null:Math.round((a+(b-a)*rnd())*100)/100;
const out=[];
for(let i=0;i<300;i++){const mode=['sale','lease','own'][i%3];const x={mode,landMode:rnd()<0.3?'own':'buy',gross:pick(50,20000,0),netRatio:pick(50,100,0.3),landCost:pick(1e8,5e10),buildUnit:pick(1e6,6e6),designRate:pick(0,10),otherCost:pick(0,5e8),contRate:pick(0,10),landTaxRate:4.6,buildTaxRate:3.16,loanRatio:pick(0,80),loanRate:pick(2,10),months:pick(6,36),saleUnit:pick(2e6,2e7),saleRate:pick(50,100),saleCostRate:pick(0,8),rentUnit:pick(5000,80000),depositUnit:pick(0,1e6),vacancy:pick(0,30),opexRate:pick(0,30),capRate:pick(3,8),holdYears:Math.round(pick(1,30,0.05)??0),discountRate:pick(2,12),target:pick(3,20)};
 const r=feasibility(x);out.push({x,r,s:sensitivity(x)});}
writeFileSync('fuzz.json',JSON.stringify(out));console.log(out.length);
