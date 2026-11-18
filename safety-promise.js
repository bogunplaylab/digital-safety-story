/* Student form: data is saved only after Firestore confirms success. */
'use strict';
const el=id=>document.getElementById(id);
const no=el('studentNo'),topic=el('topic'),promise=el('promise'),submit=el('submit'),error=el('error'),form=el('form');
const statusText=text=>{error.textContent=text};
let connected=false, currentUid=null, studentTotal=20, hadSubmission=false;
function populate(total){
 const selected=no.value;no.innerHTML='<option value="">번호 선택</option>';
 for(let i=1;i<=total;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i}번`;no.append(option)}
 if(Number(selected)<=total)no.value=selected;
}
populate(20);
promise.addEventListener('input',()=>{el('counter').textContent=`${promise.value.length} / 140자`;statusText('')});
no.addEventListener('change',async()=>{
 statusText('');hadSubmission=false;
 if(!connected||!no.value)return;
 try{
  const snap=await DSDB.submissions.doc(no.value).get();
  if(snap.exists){
   if(snap.data().uid===currentUid){topic.value=snap.data().topic;promise.value=snap.data().message;promise.dispatchEvent(new Event('input'));hadSubmission=true;statusText('이전에 제출한 내용을 불러왔어요. 수정해서 다시 제출할 수 있어요.');}
   else statusText('이미 다른 기기에서 사용 중인 번호예요. 번호를 확인해 주세요.');
  }
 }catch(e){statusText('이 번호가 다른 기기에서 사용 중이거나 확인할 수 없어요. 번호를 확인해 주세요.')}
});
topic.addEventListener('change',()=>statusText(''));
(async()=>{
 try{
  await DSDB.ready;
  currentUid=(await DSDB.ensureSignedIn()).uid;
  const snap=await DSDB.settingsDoc.get();
  studentTotal=Math.max(1,Math.min(30,Number(snap.exists?snap.data().total:20)||20));
  populate(studentTotal);connected=true;submit.disabled=false;submit.textContent='약속 제출하기';
 }catch(e){submit.disabled=true;submit.textContent='연결 설정 확인 필요';statusText('아직 Firebase에 연결되지 않았어요. 선생님께 알려 주세요.');}
})();
form.addEventListener('submit',async(e)=>{
 e.preventDefault();if(!connected)return;
 const n=no.value,t=topic.value,text=promise.value.trim();
 if(!n||Number(n)>studentTotal){statusText('학생 번호를 선택해 주세요.');no.focus();return}
 if(!t){statusText('기억에 남는 상황을 선택해 주세요.');topic.focus();return}
 if(!text){statusText('실천할 행동을 한 글자 이상 적어 주세요.');promise.focus();return}
 if(text.length>140){statusText('140자 이내로 적어 주세요.');return}
 submit.disabled=true;submit.textContent='제출 중…';statusText('');
 try{
  const ref=DSDB.submissions.doc(n);
  // Transaction makes concurrent claims for the same number atomic.
  await DSDB.db.runTransaction(async tr=>{
   const snap=await tr.get(ref);
   if(snap.exists&&snap.data().uid!==currentUid)throw new Error('이미 다른 기기에서 제출한 번호입니다. 학생 번호를 확인해 주세요.');
   if(snap.exists)tr.update(ref,{topic:t,message:text,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
   else tr.set(ref,{studentNo:n,uid:currentUid,topic:t,message:text,hidden:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  });
  el('resultNo').textContent=`${n}번 학생`;
  el('resultTopic').textContent=`기억에 남는 상황: ${t}`;
  el('resultPromise').textContent=text;
  form.style.display='none';el('done').style.display='block';hadSubmission=true;
 }catch(err){statusText(err.message?.includes('다른 기기')?err.message:'제출하지 못했어요. 번호와 인터넷 연결을 확인한 뒤 다시 눌러 주세요.');}
 finally{submit.disabled=false;submit.textContent='약속 제출하기'}
});
el('edit').addEventListener('click',()=>{el('done').style.display='none';form.style.display='flex';promise.focus()});
