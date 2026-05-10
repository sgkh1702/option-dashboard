import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

function LineChart({ canvasRef, data, options }) {
  const inst=useRef(null);
  useEffect(()=>{
    if(!canvasRef.current||!data)return;
    if(inst.current)inst.current.destroy();
    inst.current=new Chart(canvasRef.current,{type:"line",data,options});
    return()=>inst.current?.destroy();
  },[data]);
  return <div style={{position:"relative",height:"220px"}}><canvas ref={canvasRef}/></div>;
}

export default function PCRChart({ pcrHistory, atmHistory }) {
  const pcrRef=useRef(null), atmRef=useRef(null);
  const pcrInst=useRef(null), atmInst=useRef(null);

  useEffect(()=>{
    if(!pcrHistory?.length||!pcrRef.current)return;
    if(pcrInst.current)pcrInst.current.destroy();
    pcrInst.current=new Chart(pcrRef.current,{
      type:"line",
      data:{
        labels:pcrHistory.map(r=>r.time),
        datasets:[
          {label:"CE OI Chg",data:pcrHistory.map(r=>r.ce_oi_chg/1000),borderColor:"#378ADD",borderWidth:2,pointRadius:0,tension:0.3,fill:false},
          {label:"PE OI Chg",data:pcrHistory.map(r=>r.pe_oi_chg/1000),borderColor:"#D4537E",borderWidth:2,pointRadius:0,tension:0.3,fill:false},
          {label:"Spot",     data:pcrHistory.map(r=>r.spot),           borderColor:"#1D9E75",borderWidth:1.5,pointRadius:0,tension:0.3,yAxisID:"y2",fill:false,borderDash:[4,2]},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxRotation:45,minRotation:45},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"OI Chg (K)",font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
          y2:{position:"right",ticks:{font:{size:10}},title:{display:true,text:"Spot",font:{size:10}},grid:{drawOnChartArea:false}},
        },
      },
    });
    return()=>pcrInst.current?.destroy();
  },[pcrHistory]);

  useEffect(()=>{
    if(!atmHistory?.atm?.length||!atmRef.current)return;
    if(atmInst.current)atmInst.current.destroy();
    atmInst.current=new Chart(atmRef.current,{
      type:"line",
      data:{
        labels:atmHistory.atm.map(r=>r.time),
        datasets:[
          {label:"ATM-1 CE",data:atmHistory.m1.map(r=>r.ce_oi_chg/1000), borderColor:"rgba(55,138,221,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false},
          {label:"ATM-1 PE",data:atmHistory.m1.map(r=>r.pe_oi_chg/1000), borderColor:"rgba(212,83,126,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false},
          {label:"ATM CE",  data:atmHistory.atm.map(r=>r.ce_oi_chg/1000),borderColor:"#378ADD",              borderWidth:2,  pointRadius:2,tension:0.3,fill:false},
          {label:"ATM PE",  data:atmHistory.atm.map(r=>r.pe_oi_chg/1000),borderColor:"#D4537E",              borderWidth:2,  pointRadius:2,tension:0.3,fill:false},
          {label:"ATM+1 CE",data:atmHistory.p1.map(r=>r.ce_oi_chg/1000), borderColor:"rgba(55,138,221,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false,borderDash:[3,2]},
          {label:"ATM+1 PE",data:atmHistory.p1.map(r=>r.pe_oi_chg/1000), borderColor:"rgba(212,83,126,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false,borderDash:[3,2]},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{position:"bottom",labels:{font:{size:10},boxWidth:12}}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxRotation:45,minRotation:45},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"OI Chg (K)",font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
        },
      },
    });
    return()=>atmInst.current?.destroy();
  },[atmHistory]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Overall CE / PE OI Change + Spot</div>
        <div className="flex gap-4 mb-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-blue-500"></span>CE OI Chg</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-pink-500"></span>PE OI Chg</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-teal-500"></span>Spot</span>
        </div>
        <div style={{position:"relative",height:"220px"}}><canvas ref={pcrRef}/></div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">ATM ± 1 Strike OI Change</div>
        <div style={{position:"relative",height:"220px"}}><canvas ref={atmRef}/></div>
      </div>
    </div>
  );
}
