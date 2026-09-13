'use client'
import { saveDependency, computeCPMSchedule, cleanSubstagePredecessor } from './milestonePlanActions'

import { Fragment, useEffect, useState } from 'react'
import {
  getMilestonePlanData,
  saveMilestonePlan,
  generateSubstagesFromBOQ,
  type MilestonePlanStage,
  type MilestonePlanSubstage,
  type LabourAssignment,
} from './milestonePlanActions'

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))
}

type Props = {
  bookingRef: string
  jobCardType: string
}

type SubDraft = { code: string; name: string; description: string; day: string; plannedHours: string; startTimeSlot: string; plannedStartDate: string; tradeType: string; skilled: string; unskilled: string; predecessorCode: string; dependencyType: string; lagDays: string; lagHours: string; floatDays: string; bufferDays: string; isCriticalPath: boolean; resourceConstraint: string; constraintType: string; constraintDate: string; weatherDelayDays: string; evidence: string; supervisorChecklist: string; subcoordinatorChecklist: string; coordinatorChecklist: string }
const EMPTY_DRAFT: SubDraft = { code: '', name: '', description: '', day: '', plannedHours: '8', startTimeSlot: 'Full Day', plannedStartDate: '', tradeType: 'Mason', skilled: '', unskilled: '', predecessorCode: '', dependencyType: 'FS', lagDays: '0', lagHours: '0', floatDays: '0', bufferDays: '0', isCriticalPath: false, resourceConstraint: '', constraintType: 'ASAP', constraintDate: '', weatherDelayDays: '0', evidence: '', supervisorChecklist: '', subcoordinatorChecklist: '', coordinatorChecklist: '' }

export default function MilestonePlanTab({ bookingRef, jobCardType }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stages, setStages] = useState<MilestonePlanStage[]>([])
  const [saving, setSaving] = useState(false)
  const [expandedSubstage, setExpandedSubstage] = useState<string|null>(null)
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [addSubstageFor, setAddSubstageFor] = useState<string | null>(null)
  const [subDraft, setSubDraft] = useState<SubDraft>(EMPTY_DRAFT)

  const [addStageOpen, setAddStageOpen] = useState(false)
  const [stageDraft, setStageDraft] = useState<SubDraft & { stageCode: string }>({ ...EMPTY_DRAFT, stageCode: '' })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getMilestonePlanData(bookingRef, jobCardType).then(res => {
      if (cancelled) return
      if (res.error) {
        setLoadError(res.error)
      } else {
        setStages(res.stages ?? [])
      }
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingRef, jobCardType])

  function updateSubstage(
    milestoneCode: string,
    substageCode: string,
    patch: Partial<MilestonePlanSubstage>,
  ) {
    setStages(prev =>
      prev.map(stage =>
        stage.milestoneCode !== milestoneCode
          ? stage
          : {
              ...stage,
              subStages: stage.subStages.map(sub =>
                sub.substageCode !== substageCode ? sub : { ...sub, ...patch },
              ),
            },
      ),
    )
  }

  function openAddSubstage(milestoneCode: string) {
    setAddSubstageFor(milestoneCode)
    setSubDraft(EMPTY_DRAFT)
  }

  function submitAddSubstage(milestoneCode: string) {
    if (!subDraft.code.trim() || !subDraft.name.trim()) return
    const newSub: MilestonePlanSubstage = {
      substageCode: subDraft.code.trim(),
      substageName: subDraft.name.trim(),
      plannedDay: parseFloat(subDraft.day) || 0,
      skilledWorkersPerDay: parseFloat(subDraft.skilled) || 0,
      unskilledWorkersPerDay: parseFloat(subDraft.unskilled) || 0,
      evidenceRequired: subDraft.evidence.split('\n').map(s => s.trim()).filter(Boolean),
      status: 'pending',
      isCustom: true,
      substageDescription: subDraft.description||undefined,
      plannedHours: parseFloat(subDraft.plannedHours)||8,
      startTimeSlot: subDraft.startTimeSlot||'Full Day',
      plannedStartDate: subDraft.plannedStartDate||undefined,
      tradeType: subDraft.tradeType||undefined,
      predecessorCode: subDraft.predecessorCode||undefined,
      dependencyType: subDraft.dependencyType||'FS',
      lagDays: parseFloat(subDraft.lagDays)||0,
      lagHours: parseFloat(subDraft.lagHours)||0,
      floatDays: parseFloat(subDraft.floatDays)||0,
      bufferDays: parseFloat(subDraft.bufferDays)||0,
      isCriticalPath: subDraft.isCriticalPath||false,
      resourceConstraint: subDraft.resourceConstraint||undefined,
      constraintType: subDraft.constraintType||'ASAP',
      constraintDate: subDraft.constraintDate||undefined,
      weatherDelayDays: parseInt(subDraft.weatherDelayDays)||0,
      supervisorChecklist: subDraft.supervisorChecklist?subDraft.supervisorChecklist.split('\n').filter(Boolean):undefined,
      subcoordinatorChecklist: subDraft.subcoordinatorChecklist?subDraft.subcoordinatorChecklist.split('\n').filter(Boolean):undefined,
      coordinatorChecklist: subDraft.coordinatorChecklist?subDraft.coordinatorChecklist.split('\n').filter(Boolean):undefined,
    }
    setStages(prev =>
      prev.map(stage =>
        stage.milestoneCode !== milestoneCode
          ? stage
          : { ...stage, subStages: [...stage.subStages, newSub] },
      ),
    )
    setAddSubstageFor(null)
    setSubDraft(EMPTY_DRAFT)
  }

  function submitAddStage() {
    if (!stageDraft.stageCode.trim() || !stageDraft.code.trim() || !stageDraft.name.trim()) return
    const newSub: MilestonePlanSubstage = {
      substageCode: stageDraft.code.trim(),
      substageName: stageDraft.name.trim(),
      plannedDay: parseFloat(stageDraft.day) || 0,
      skilledWorkersPerDay: parseFloat(stageDraft.skilled) || 0,
      unskilledWorkersPerDay: parseFloat(stageDraft.unskilled) || 0,
      evidenceRequired: stageDraft.evidence.split('\n').map(s => s.trim()).filter(Boolean),
      status: 'pending',
      isCustom: true,
      substageDescription: stageDraft.description||undefined,
      plannedHours: parseFloat(stageDraft.plannedHours)||8,
      startTimeSlot: stageDraft.startTimeSlot||'Full Day',
      plannedStartDate: stageDraft.plannedStartDate||undefined,
      tradeType: stageDraft.tradeType||undefined,
      predecessorCode: stageDraft.predecessorCode||undefined,
      dependencyType: stageDraft.dependencyType||'FS',
      lagDays: parseFloat(stageDraft.lagDays)||0,
      lagHours: parseFloat(stageDraft.lagHours)||0,
      floatDays: parseFloat(stageDraft.floatDays)||0,
      bufferDays: parseFloat(stageDraft.bufferDays)||0,
      isCriticalPath: stageDraft.isCriticalPath||false,
      resourceConstraint: stageDraft.resourceConstraint||undefined,
      constraintType: stageDraft.constraintType||'ASAP',
      constraintDate: stageDraft.constraintDate||undefined,
      weatherDelayDays: parseInt(stageDraft.weatherDelayDays)||0,
      supervisorChecklist: stageDraft.supervisorChecklist?stageDraft.supervisorChecklist.split('\n').filter(Boolean):undefined,
      subcoordinatorChecklist: stageDraft.subcoordinatorChecklist?stageDraft.subcoordinatorChecklist.split('\n').filter(Boolean):undefined,
      coordinatorChecklist: stageDraft.coordinatorChecklist?stageDraft.coordinatorChecklist.split('\n').filter(Boolean):undefined,
    }
    const newStage: MilestonePlanStage = {
      milestoneCode: stageDraft.stageCode.trim(),
      milestoneName: stageDraft.stageCode.trim(),
      paymentPercent: null,
      milestoneNumber: 1000 + stages.length,
      isCustomStage: true,
      rate: null,
      subStages: [newSub],
    }
    setStages(prev => [...prev, newStage])
    setAddStageOpen(false)
    setStageDraft({ ...EMPTY_DRAFT, stageCode: '' })
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const rows = stages.flatMap(stage =>
        stage.subStages.map(sub => ({
          milestoneCode: stage.milestoneCode,
          substageCode: sub.substageCode,
          substageName: sub.substageName,
          plannedDay: sub.plannedDay,
          skilledWorkersPerDay: sub.skilledWorkersPerDay,
          unskilledWorkersPerDay: sub.unskilledWorkersPerDay,
          evidenceRequired: sub.evidenceRequired,
          status: sub.status,
          substageDescription: sub.substageDescription,
          plannedHours: sub.plannedHours,
          startTimeSlot: sub.startTimeSlot,
          plannedStartDate: sub.plannedStartDate,
          tradeType: sub.tradeType,
          predecessorCode: sub.predecessorCode,
          dependencyType: sub.dependencyType,
          lagDays: sub.lagDays,
          lagHours: sub.lagHours,
          floatDays: sub.floatDays,
          bufferDays: sub.bufferDays,
          isCriticalPath: sub.isCriticalPath,
          resourceConstraint: sub.resourceConstraint,
          constraintType: sub.constraintType,
          constraintDate: sub.constraintDate,
          weatherDelayDays: sub.weatherDelayDays,
          supervisorChecklist: sub.supervisorChecklist,
          subcoordinatorChecklist: sub.subcoordinatorChecklist,
          coordinatorChecklist: sub.coordinatorChecklist,
        })),
      )
      const res = await saveMilestonePlan(bookingRef, rows)
      if (res.error) throw new Error(res.error)
      setSaveMsg({ text: `Milestone plan saved — ${res.savedCount ?? 0} sub-stage(s).`, ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center">
        <p className="text-sm font-semibold text-gray-500">Loading milestone plan…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
        <p className="text-sm font-semibold text-red-700">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stages.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-10 text-center">
          <p className="text-sm font-semibold text-gray-500">No milestone stage templates found for this job type.</p>
          <p className="text-xs text-gray-400 mt-1">Use &ldquo;Add Stage&rdquo; below to build a plan manually.</p>
        </div>
      )}

      {stages.map(stage => (
        <div key={stage.milestoneCode} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#1F3864] text-white flex items-center justify-between">
            <p className="font-bold text-sm">
              {stage.milestoneCode} — {stage.milestoneName}
              {stage.isCustomStage && <span className="ml-2 text-xs font-normal text-blue-200">(custom)</span>}
            </p>
            {stage.paymentPercent != null && (
              <span className="text-xs text-blue-200">{stage.paymentPercent}% of contract value</span>
            )}
          </div>

          {stage.rate ? (
            <div className="px-5 py-2 bg-blue-50 border-b border-blue-200">
              <span className="text-xs font-bold text-[#1F3864]">
                BOQ Reference Labour Cost: ₹ {fmtInr(stage.rate.boqLabourCost)}
              </span>
            </div>
          ) : (
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-200">
              <span className="text-xs font-bold text-amber-700">No rate configured for {stage.milestoneCode}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-[32%]">Sub-stage</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[16%]">Planned Day</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[26%]">Skilled Workers/Day</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide w-[26%]">Unskilled Workers/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stage.subStages.map(sub => {
                  const calcHours=(start:string,end:string):number=>{
    const [sh,sm]=start.split(':').map(Number)
    const [eh,em]=end.split(':').map(Number)
    return Math.max(0,((eh*60+em)-(sh*60+sm))/60)
  }

  return (
                    <Fragment key={sub.substageCode}>
                    <tr className="cursor-pointer hover:bg-blue-50/30" onClick={()=>setExpandedSubstage(expandedSubstage===sub.substageCode?null:sub.substageCode)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{expandedSubstage===sub.substageCode?'▼':'▶'}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{sub.substageCode} — {sub.substageName}</p>
                            {sub.isCustom && <p className="text-xs text-[#2E74B5] mt-0.5">Added by coordinator</p>}
                            {sub.tradeType && <p className="text-xs text-gray-500 mt-0.5">{sub.tradeType} · {sub.plannedDay}d · {sub.startTimeSlot||'Full Day'}</p>}
                            {sub.evidenceRequired && sub.evidenceRequired.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">{sub.evidenceRequired.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={e=>e.stopPropagation()}>
                        <input type="number" value={sub.plannedDay} onChange={e=>updateSubstage(stage.milestoneCode,sub.substageCode,{plannedDay:parseFloat(e.target.value)||0})} onBlur={async()=>{if(sub.id)await saveDependency(sub.id,{predecessorCode:sub.predecessorCode,dependencyType:sub.dependencyType,lagDays:sub.lagDays,lagHours:sub.lagHours,isCriticalPath:sub.isCriticalPath,plannedDay:sub.plannedDay});await computeCPMSchedule(bookingRef);window.location.reload()}} className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={e=>e.stopPropagation()}>
                        <input type="number" value={sub.skilledWorkersPerDay} onChange={e=>updateSubstage(stage.milestoneCode,sub.substageCode,{skilledWorkersPerDay:parseFloat(e.target.value)||0})} className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                      </td>
                      <td className="px-3 py-3 text-right" onClick={e=>e.stopPropagation()}>
                        <input type="number" value={sub.unskilledWorkersPerDay} onChange={e=>updateSubstage(stage.milestoneCode,sub.substageCode,{unskilledWorkersPerDay:parseFloat(e.target.value)||0})} className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E74B5]/40"/>
                      </td>
                    </tr>
                    {expandedSubstage===sub.substageCode && (
                      <tr key={sub.substageCode+'-expand'}>
                        <td colSpan={4} className="px-4 py-4 bg-blue-50/40 border-t border-blue-100">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wide">Labour Assignment — {sub.substageCode}</p>
                              <button type="button" onClick={e=>{e.stopPropagation();const rows=sub.labourAssignments||[];const newRow:LabourAssignment={rowId:Date.now().toString(),trade:sub.tradeType||'Mason',skillType:'skilled',qty:1,startTime:'08:00',endTime:'17:00',hoursPerDay:8,daysNeeded:sub.plannedDay||1,canUseMultiskill:true,minSkillLevel:'mid'};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:[...rows,newRow]})}} className="text-xs bg-[#2E74B5] text-white px-3 py-1 rounded-lg hover:bg-[#1F3864]">+ Add Trade Row</button>
                            </div>
                            {(sub.labourAssignments||[]).length===0 && (
                              <p className="text-xs text-gray-400 italic">No labour rows defined. Click + Add Trade Row to begin.</p>
                            )}
                            {(sub.labourAssignments||[]).map((row,ri)=>(
                              <div key={row.rowId} className="grid grid-cols-8 gap-2 items-center bg-white rounded-lg px-3 py-2 border border-gray-200">
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Trade</label><select className="w-full border rounded px-1 py-1 text-xs" value={row.trade} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];rows[ri]={...rows[ri],trade:e.target.value};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}><option>Mason</option><option>Plumber</option><option>Electrician</option><option>Waterproofer</option><option>Tiler</option><option>Helper</option><option>Supervisor</option><option>Carpenter</option></select></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Type</label><select className="w-full border rounded px-1 py-1 text-xs" value={row.skillType} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];rows[ri]={...rows[ri],skillType:e.target.value as 'skilled'|'unskilled'};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}><option value="skilled">Skilled</option><option value="unskilled">Unskilled</option></select></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Qty</label><input type="number" min="1" className="w-full border rounded px-1 py-1 text-xs" value={row.qty} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];rows[ri]={...rows[ri],qty:parseInt(e.target.value)||1};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}/></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Start</label><input type="time" className="w-full border rounded px-1 py-1 text-xs" value={row.startTime} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];const hrs=calcHours(e.target.value,rows[ri].endTime);rows[ri]={...rows[ri],startTime:e.target.value,hoursPerDay:hrs};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}/></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">End</label><input type="time" className="w-full border rounded px-1 py-1 text-xs" value={row.endTime} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];const hrs=calcHours(rows[ri].startTime,e.target.value);rows[ri]={...rows[ri],endTime:e.target.value,hoursPerDay:hrs};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}/></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Days</label><input type="number" min="1" className="w-full border rounded px-1 py-1 text-xs" value={row.daysNeeded} onClick={e=>e.stopPropagation()} onChange={e=>{const rows=[...(sub.labourAssignments||[])];rows[ri]={...rows[ri],daysNeeded:parseInt(e.target.value)||1};updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}}/></div>
                                <div className="col-span-1"><label className="block text-xs text-gray-400 mb-0.5">Hrs · Total</label><p className="text-xs font-bold text-[#1F3864]">{row.hoursPerDay}h · {(row.hoursPerDay*(row.daysNeeded||1)*(row.qty||1)).toFixed(0)}h</p></div>
                                <div className="col-span-1 flex items-end justify-end"><button type="button" onClick={e=>{e.stopPropagation();const rows=(sub.labourAssignments||[]).filter((_,i)=>i!==ri);updateSubstage(stage.milestoneCode,sub.substageCode,{labourAssignments:rows})}} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded">✕</button></div>
                              </div>
                            ))}
                            {(sub.labourAssignments||[]).length>0 && (
                              <div className="flex gap-6 text-xs text-gray-600 px-3 pt-1 border-t border-blue-100">
                                <span>Skilled Hours: <strong className="text-[#1F3864]">{(sub.labourAssignments||[]).filter(r=>r.skillType==='skilled').reduce((s,r)=>s+r.hoursPerDay*(r.daysNeeded||1)*(r.qty||1),0).toFixed(0)}h</strong></span>
                                <span>Unskilled Hours: <strong className="text-[#1F3864]">{(sub.labourAssignments||[]).filter(r=>r.skillType==='unskilled').reduce((s,r)=>s+r.hoursPerDay*(r.daysNeeded||1)*(r.qty||1),0).toFixed(0)}h</strong></span>
                              </div>
                            )}
                          
                            <div className="mt-4 pt-3 border-t border-blue-100">
                              <p className="text-xs font-bold text-[#1F3864] uppercase tracking-wide mb-2">Dependency &amp; Schedule</p>
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-xs text-gray-400 mb-0.5">Predecessor Code</label>
                                  <input className="w-full border rounded px-1 py-1 text-xs" placeholder="e.g. LAB-ISO-01" value={sub.predecessorCode||''} onClick={e=>e.stopPropagation()} onBlur={async e=>{await cleanSubstagePredecessor(bookingRef,sub.substageCode,e.target.value||null);await computeCPMSchedule(bookingRef);window.location.reload()}} onChange={e=>updateSubstage(stage.milestoneCode,sub.substageCode,{predecessorCode:e.target.value})}/>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400 mb-0.5">Dependency Type</label>
                                  <select className="w-full border rounded px-1 py-1 text-xs" value={sub.dependencyType||'FS'} onClick={e=>e.stopPropagation()} onChange={async e=>{updateSubstage(stage.milestoneCode,sub.substageCode,{dependencyType:e.target.value});if(sub.id)saveDependency(sub.id,{predecessorCode:sub.predecessorCode,dependencyType:e.target.value,lagDays:sub.lagDays,lagHours:sub.lagHours,isCriticalPath:sub.isCriticalPath})}} onBlur={async()=>{await computeCPMSchedule(bookingRef);window.location.reload()}}>
                                    <option value="FS">FS — Finish to Start</option>
                                    <option value="SS">SS — Start to Start</option>
                                    <option value="FF">FF — Finish to Finish</option>
                                    <option value="SF">SF — Start to Finish</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400 mb-0.5">Lag Days</label>
                                  <input type="number" min="0" step="0.5" className="w-full border rounded px-1 py-1 text-xs" value={sub.lagDays||0} onClick={e=>e.stopPropagation()} onChange={async e=>{const v=parseFloat(e.target.value)||0;updateSubstage(stage.milestoneCode,sub.substageCode,{lagDays:v});if(sub.id)saveDependency(sub.id,{predecessorCode:sub.predecessorCode,dependencyType:sub.dependencyType,lagDays:v,lagHours:sub.lagHours,isCriticalPath:sub.isCriticalPath})}} onBlur={async()=>{await computeCPMSchedule(bookingRef);window.location.reload()}}/>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-400 mb-0.5">Lag Hours</label>
                                  <input type="number" min="0" step="1" className="w-full border rounded px-1 py-1 text-xs" value={sub.lagHours||0} onClick={e=>e.stopPropagation()} onChange={async e=>{const v=parseFloat(e.target.value)||0;updateSubstage(stage.milestoneCode,sub.substageCode,{lagHours:v});if(sub.id)saveDependency(sub.id,{predecessorCode:sub.predecessorCode,dependencyType:sub.dependencyType,lagDays:sub.lagDays,lagHours:v,isCriticalPath:sub.isCriticalPath})}} onBlur={async()=>{await computeCPMSchedule(bookingRef);window.location.reload()}}/>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1">
                                  <input type="checkbox" id={'cp-'+sub.substageCode} checked={sub.isCriticalPath||false} onClick={e=>e.stopPropagation()} onChange={async e=>{updateSubstage(stage.milestoneCode,sub.substageCode,{isCriticalPath:e.target.checked});if(sub.id)saveDependency(sub.id,{predecessorCode:sub.predecessorCode,dependencyType:sub.dependencyType,lagDays:sub.lagDays,lagHours:sub.lagHours,isCriticalPath:e.target.checked})}}/>
                                  <label htmlFor={'cp-'+sub.substageCode} className="text-xs text-gray-600">Critical Path</label>
                                </div>
                                {sub.earlyStartDate && <span className="text-xs text-green-700 font-medium">Early Start: {sub.earlyStartDate}</span>}
                                {sub.earlyFinishDate && <span className="text-xs text-green-700 font-medium">Early Finish: {sub.earlyFinishDate}</span>}
                                {sub.floatDays && sub.floatDays>0 && <span className="text-xs text-amber-600">Float: {sub.floatDays}d</span>}
                                <button type="button" onClick={async e=>{e.stopPropagation();await computeCPMSchedule(bookingRef);window.location.reload()}} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 ml-auto">RECOMPUTE SCHEDULE</button>
                              </div>
                            </div>
</div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            {addSubstageFor === stage.milestoneCode ? (
              <div className="p-3 rounded-lg bg-[#2E74B5]/5 border border-[#2E74B5]/20 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-stage Code*</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={subDraft.code} onChange={e=>setSubDraft(d=>({...d,code:e.target.value}))} placeholder="e.g. M1-A"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-stage Name*</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={subDraft.name} onChange={e=>setSubDraft(d=>({...d,name:e.target.value}))} placeholder="e.g. Demolition Complete"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Description</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={subDraft.description} onChange={e=>setSubDraft(d=>({...d,description:e.target.value}))} placeholder="Scope of work"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Trade Type</label>
                <select className="w-full border rounded px-2 py-1 text-sm" value={subDraft.tradeType} onChange={e=>setSubDraft(d=>({...d,tradeType:e.target.value}))}><option>Mason</option><option>Plumber</option><option>Electrician</option><option>Waterproofer</option><option>Tiler</option><option>Helper</option><option>Supervisor</option></select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Start Time Slot</label>
                <select className="w-full border rounded px-2 py-1 text-sm" value={subDraft.startTimeSlot} onChange={e=>setSubDraft(d=>({...d,startTimeSlot:e.target.value}))}><option>Full Day</option><option>Morning</option><option>Afternoon</option></select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Planned Days*</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.day} onChange={e=>setSubDraft(d=>({...d,day:e.target.value}))} placeholder="Days"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Hours Per Day</label>
                <input type="number" min="1" max="8" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.plannedHours} onChange={e=>setSubDraft(d=>({...d,plannedHours:e.target.value}))} placeholder="1-8"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Planned Start Date</label>
                <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.plannedStartDate} onChange={e=>setSubDraft(d=>({...d,plannedStartDate:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Skilled Workers/Day*</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.skilled} onChange={e=>setSubDraft(d=>({...d,skilled:e.target.value}))} placeholder="Count"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Unskilled Workers/Day</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.unskilled} onChange={e=>setSubDraft(d=>({...d,unskilled:e.target.value}))} placeholder="Count"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Predecessor Code</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={subDraft.predecessorCode} onChange={e=>setSubDraft(d=>({...d,predecessorCode:e.target.value}))} placeholder="e.g. M1-A"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Dependency Type</label>
                <select className="w-full border rounded px-2 py-1 text-sm" value={subDraft.dependencyType} onChange={e=>setSubDraft(d=>({...d,dependencyType:e.target.value}))}><option value="FS">FS — Finish to Start</option><option value="SS">SS — Start to Start</option><option value="FF">FF — Finish to Finish</option><option value="SF">SF — Start to Finish</option></select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Lag Days</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.lagDays} onChange={e=>setSubDraft(d=>({...d,lagDays:e.target.value}))} placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Lag Hours (curing)</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.lagHours} onChange={e=>setSubDraft(d=>({...d,lagHours:e.target.value}))} placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Float Days</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.floatDays} onChange={e=>setSubDraft(d=>({...d,floatDays:e.target.value}))} placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Buffer Days</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.bufferDays} onChange={e=>setSubDraft(d=>({...d,bufferDays:e.target.value}))} placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Constraint Type</label>
                <select className="w-full border rounded px-2 py-1 text-sm" value={subDraft.constraintType} onChange={e=>setSubDraft(d=>({...d,constraintType:e.target.value}))}><option value="ASAP">ASAP</option><option value="MSO">Must Start On</option><option value="MFO">Must Finish On</option></select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Constraint Date</label>
                <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.constraintDate} onChange={e=>setSubDraft(d=>({...d,constraintDate:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Weather Delay Days</label>
                <input type="number" min="0" className="w-full border rounded px-2 py-1 text-sm" value={subDraft.weatherDelayDays} onChange={e=>setSubDraft(d=>({...d,weatherDelayDays:e.target.value}))} placeholder="0"/>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer"><input type="checkbox" checked={subDraft.isCriticalPath} onChange={e=>setSubDraft(d=>({...d,isCriticalPath:e.target.checked}))}/>Critical Path</label>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Resource Constraint</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={subDraft.resourceConstraint} onChange={e=>setSubDraft(d=>({...d,resourceConstraint:e.target.value}))} placeholder="e.g. Plumber must finish M1-C first"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Evidence Items (one per line)*</label>
                <textarea rows={4} className="w-full border rounded px-2 py-1 text-sm" value={subDraft.evidence} onChange={e=>setSubDraft(d=>({...d,evidence:e.target.value}))} placeholder="Photo of completed work"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Supervisor Checklist (one per line)</label>
                <textarea rows={3} className="w-full border rounded px-2 py-1 text-sm" value={subDraft.supervisorChecklist} onChange={e=>setSubDraft(d=>({...d,supervisorChecklist:e.target.value}))} placeholder="Confirm work complete"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-coordinator Checklist (one per line)</label>
                <textarea rows={3} className="w-full border rounded px-2 py-1 text-sm" value={subDraft.subcoordinatorChecklist} onChange={e=>setSubDraft(d=>({...d,subcoordinatorChecklist:e.target.value}))} placeholder="Confirm scope matches BOQ"/>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">Coordinator Checklist (one per line)</label>
                <textarea rows={3} className="w-full border rounded px-2 py-1 text-sm" value={subDraft.coordinatorChecklist} onChange={e=>setSubDraft(d=>({...d,coordinatorChecklist:e.target.value}))} placeholder="Confirm ready for payment"/>
              </div>
              </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => submitAddSubstage(stage.milestoneCode)} className="px-4 py-2 rounded-lg bg-[#1F3864] text-white text-xs font-bold">Add</button>
                  <button type="button" onClick={() => setAddSubstageFor(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAddSubstage(stage.milestoneCode)}
                className="px-4 py-2 rounded-lg border border-[#1F3864]/30 text-[#1F3864] text-xs font-bold hover:bg-[#1F3864]/5 transition-colors"
              >
                + Add Sub-stage
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add Stage */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        {addStageOpen ? (
          <div className="p-3 rounded-lg bg-[#2E74B5]/5 border border-[#2E74B5]/20 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              New Stage — requires its first sub-stage
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Stage Code (e.g. M4)</label>
                <input placeholder="M4" value={stageDraft.stageCode} onChange={e => setStageDraft(d => ({ ...d, stageCode: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-stage Code (e.g. M1-A)</label>
                <input placeholder="M4-A" value={stageDraft.code} onChange={e => setStageDraft(d => ({ ...d, code: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Sub-stage Name</label>
                <input placeholder="Sub-stage name" value={stageDraft.name} onChange={e => setStageDraft(d => ({ ...d, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Planned Days</label>
                <input placeholder="0" type="number" value={stageDraft.day} onChange={e => setStageDraft(d => ({ ...d, day: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Skilled Workers/Day</label>
                <input placeholder="0" type="number" value={stageDraft.skilled} onChange={e => setStageDraft(d => ({ ...d, skilled: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Unskilled Workers/Day</label>
                <input placeholder="0" type="number" value={stageDraft.unskilled} onChange={e => setStageDraft(d => ({ ...d, unskilled: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Evidence Items (one per line)</label>
              <textarea rows={3} placeholder="Photo of completed work&#10;Supervisor sign-off" value={stageDraft.evidence} onChange={e => setStageDraft(d => ({ ...d, evidence: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={submitAddStage} className="px-4 py-2 rounded-lg bg-[#1F3864] text-white text-xs font-bold">Add Stage</button>
              <button type="button" onClick={() => setAddStageOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddStageOpen(true)}
            className="w-full py-2.5 rounded-xl border border-[#1F3864]/30 text-[#1F3864] text-xs font-bold hover:bg-[#1F3864]/5 transition-colors"
          >
            + ADD STAGE
          </button>
        )}
      </div>

      {saveMsg && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-semibold ${
          saveMsg.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {saveMsg.text}
        </div>
      )}

      <button
        type="button"
        onClick={async()=>{
          setLoading(true)
          const result=await generateSubstagesFromBOQ(bookingRef)
          if(result.error){alert(result.error)}else{setStages(result.stages)}
          setLoading(false)
        }}
        className="w-full py-3 rounded-xl bg-[#2E74B5] text-white text-sm font-bold hover:bg-[#1F3864] transition-colors mb-2"
      >
        GENERATE FROM BOQ ESTIMATE
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="w-full py-4 rounded-xl bg-[#1F3864] text-white text-sm font-bold hover:bg-[#162950] transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'SAVE MILESTONE PLAN'}
      </button>
    </div>
  )
}
