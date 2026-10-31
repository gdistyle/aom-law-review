# 독립 검산기: feasibility.js를 보지 않고 산식 명세만으로 재구현
import json
def z(v): return 0.0 if v is None else float(v)
def calc(x):
    g=z(x.get('gross')); L=0.0 if x['landMode']=='own' else z(x.get('landCost'))
    lt=L*z(x['landTaxRate'])/100; C=z(x.get('buildUnit'))*g; D=C*z(x.get('designRate'))/100
    bt=C*z(x['buildTaxRate'])/100; O=z(x.get('otherCost')); ct=C*z(x.get('contRate'))/100
    S=L+lt+C+D+bt+O+ct; loan=S*z(x.get('loanRatio'))/100; I=loan*z(x.get('loanRate'))/100*z(x.get('months'))/12
    o=dict(subtotal=S,interest=I,loan=loan)
    if x['mode']=='sale':
        R=z(x.get('saleUnit'))*g*z(x.get('saleRate'))/100; sc=R*z(x.get('saleCostRate'))/100; T=S+I+sc
        o.update(total=T,revenue=R,profit=R-T,metric=(R-T)/T if T>0 else None)
    elif x['mode']=='lease':
        T=S+I; occ=1-z(x.get('vacancy'))/100; gr=z(x.get('rentUnit'))*g*12*occ; noi=gr*(1-z(x.get('opexRate'))/100)
        dep=z(x.get('depositUnit'))*g*occ; ni=T-dep; cap=z(x.get('capRate'))/100
        val=noi/cap if cap>0 else None
        yrs=round(z(x.get('holdYears')))
        cfs=[-ni]+[noi+((val-dep) if (t==yrs and val is not None) else 0) for t in range(1,yrs+1)] if ni>0 and yrs>0 else []
        npv=None
        if cfs and x.get('discountRate') is not None:
            r=z(x['discountRate'])/100; npv=sum(c/(1+r)**t for t,c in enumerate(cfs))
        o.update(total=T,noi=noi,deposit=dep,netInvest=ni,value=val,metric=noi/ni if ni>0 else None,npv=npv)
    else:
        T=S+I; o.update(total=T,perM2=T/g if g>0 else None,metric=None)
    return o
def sens(x):
    if x['mode']=='own': return None
    k='saleUnit' if x['mode']=='sale' else 'rentUnit'; out=[]
    for a in (-0.1,0,0.1):
        row=[]
        for b in (-0.1,0,0.1):
            y=dict(x); y['buildUnit']=z(x.get('buildUnit'))*(1+a); y[k]=z(x.get(k))*(1+b); row.append(calc(y)['metric'])
        out.append(row)
    return out
data=json.load(open('fuzz.json')); bad=0; checks=0
def close(a,b):
    if a is None or b is None: return a is None and b is None
    return abs(a-b)<=max(1e-9,abs(b)*1e-12, 1e-6 if abs(b)<10 else 0.01)
for d in data:
    p=calc(d['x']); r=d['r']
    for k,v in p.items():
        jv=r.get(k); checks+=1
        if not close(v,jv): bad+=1; print('X',d['x']['mode'],k,v,jv)
    ps=sens(d['x']); js=d['s']
    if ps is not None:
        for i in range(3):
            for j in range(3):
                checks+=1
                if not close(ps[i][j],js[i][j]): bad+=1; print('S',i,j,ps[i][j],js[i][j])
print('cases',len(data),'checks',checks,'mismatch',bad)
