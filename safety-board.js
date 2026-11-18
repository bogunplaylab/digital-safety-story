/* Teacher-facing realtime board with local PIN gate and Firebase-auth protected destructive actions. */
'use strict';
const $=id=>document.getElementById(id);
const colors=['#fff1a5','#ffceda','#d0efcf','#d1e7ff','#e9d7ff'];
const pins=['#ffcb47','#f78eaf','#a6d77c','#87bde9','#bc93ea'];
const angles=['-1.2deg','.8deg','-.6deg','1.1deg','-.9deg'];
let submissions=new Map(),total=20,selected=null,isAdmin=false,stopListening=null,ready=false;
function setStatus(t){$('connection').textContent=t}
const clamp=x=>Math.max(1,Math.min(30,Math.round(Number(x)||20)));
function render(){
 const shown=[...submissions].filter(([n,v])=>n<=total&&!v.hidden).length;
 $('status').textContent=`${total}명 중 ${shown}명 제출`;
 const notes=$('notes');notes.innerHTML='';notes.style.gridTemplateRows=total<=20?'repeat(4,minmax(0,1fr))':`repeat(${Math.ceil(total/5)},minmax(0,1fr))`;
 for(let i=1;i<=total;i++){
  const data=submissions.get(i),visible=data&&!data.hidden,j=(i-1)%5;
  const btn=document.createElement('button');btn.type='button';btn.className='note'+(visible?'':' empty');
  btn.style.setProperty('--note',colors[j]);btn.style.setProperty('--pin',pins[j]);btn.style.setProperty('--angle',angles[i%5]);
  btn.setAttribute('aria-label',`${i}번 ${visible?'의견 자세히 보기':'미제출'}`);
  const number=document.createElement('span');number.className='number';number.textContent=`${i}번`;
  const message=document.createElement('span');message.className='message';message.textContent=visible?data.message:(data?.hidden?'숨겨진 의견':'미제출');
  btn.append(number,message);btn.disabled=!data;
  if(data)btn.addEventListener('click',()=>showNote(i,data,j));
  notes.append(btn);
 }
 $('hide').disabled=!isAdmin||selected===null;
}
function showNote(i,data,j){
 selected=i;$('modalNumber').textContent=`${i}번 학생`;
 $('modalMessage').textContent=data.hidden?'숨김 처리된 의견입니다.':data.message;
 const card=$('modal').querySelector('.modal-card');card.style.setProperty('--modal-note',colors[j]);card.style.borderColor=pins[j];
 $('moderateHint').textContent=isAdmin?'이 의견을 숨기려면 팝업을 닫고 상단의 ‘선택 의견 숨김’을 누르세요.':'';
 $('modal').classList.add('open');$('close').focus();render();
}
function close(){ $('modal').classList.remove('open') }
$('close').addEventListener('click',close);$('modal').addEventListener('click',e=>{if(e.target===$('modal'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
$('pinForm').addEventListener('submit',e=>{
 e.preventDefault();
 if($('pin').value!=='0504'){$('pinError').textContent='PIN을 확인해 주세요.';return}
 $('pinGate').hidden=true;$('pinGate').style.display='none';$('app').hidden=false;document.body.classList.add('entered');
 start();
});
async function start(){
 try{
  await DSDB.ready;await DSDB.ensureSignedIn();
  const snap=await DSDB.settingsDoc.get();total=clamp(snap.exists?snap.data().total:20);$('total').value=total;
  ready=true;render();setStatus('교사용 PIN 확인 완료 · 학생 의견 열람은 Firebase 관리자 인증 후 가능합니다.');
 }catch(e){setStatus('Firebase 연결 설정 또는 인터넷 연결을 확인해 주세요.');}
}
function checkAdmin(){return isAdmin&&DSDB.auth.currentUser?.uid===DSDB.teacherUid&&Boolean(DSDB.teacherUid)}
$('teacherLogin').addEventListener('click',async()=>{
 if(!ready){alert('Firebase 연결을 먼저 확인해 주세요.');return}
 const email=window.prompt('Firebase 관리자 이메일을 입력하세요.');if(!email)return;
 const pass=window.prompt('Firebase 관리자 비밀번호를 입력하세요.');if(!pass)return;
 try{
  const result=await DSDB.auth.signInWithEmailAndPassword(email,pass);
  if(result.user.uid!==DSDB.teacherUid){await DSDB.auth.signOut();throw new Error('등록된 관리자 계정이 아닙니다.')}
  isAdmin=true;$('teacherLogin').hidden=true;$('logout').hidden=false;$('total').disabled=false;$('clear').disabled=false;
  const settingsSnapshot=await DSDB.settingsDoc.get();total=clamp(settingsSnapshot.exists?settingsSnapshot.data().total:20);$('total').value=total;
  stopListening=DSDB.submissions.onSnapshot(snap=>{
   submissions=new Map();snap.forEach(doc=>{const n=Number(doc.id);if(n>=1&&n<=30)submissions.set(n,doc.data())});
   render();setStatus('실시간 연결됨 · 새 의견이 즉시 표시됩니다.');
  },()=>setStatus('의견 조회 권한을 확인해 주세요. 기존 Firestore 규칙에 허용 범위가 있는지 점검하세요.'));
  render();setStatus('Firebase 관리자 인증 완료 · 게시판 연결 중…');
 }catch(e){alert('관리자 인증에 실패했습니다. Firebase 설정·관리자 UID를 확인해 주세요.');}
});
$('logout').addEventListener('click',async()=>{
 if(stopListening){stopListening();stopListening=null}submissions.clear();isAdmin=false;await DSDB.auth.signOut();await DSDB.auth.signInAnonymously();$('teacherLogin').hidden=false;$('logout').hidden=true;$('total').disabled=true;$('clear').disabled=true;selected=null;render();setStatus('관리자 로그아웃 완료');
});
$('total').addEventListener('change',async()=>{
 if(!checkAdmin())return;
 const newTotal=clamp($('total').value);$('total').value=newTotal;
 if(!window.confirm(`전체 인원수를 ${newTotal}명으로 설정할까요? 기존 제출 내용은 삭제되지 않습니다.`)){ $('total').value=total;return }
 try{await DSDB.settingsDoc.set({total:newTotal,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})}
 catch(e){alert('인원수 저장에 실패했습니다.');$('total').value=total}
});
$('hide').addEventListener('click',async()=>{
 if(!checkAdmin()||selected===null)return;
 const d=submissions.get(selected);if(!d)return;
 if(!confirm(`${selected}번 학생의 의견을 ${d.hidden?'다시 표시':'숨김 처리'}할까요?`))return;
 try{await DSDB.submissions.doc(String(selected)).update({hidden:!d.hidden});selected=null;render();close()}
 catch(e){alert('의견 상태 변경에 실패했습니다. 관리자 권한을 확인해 주세요.')}
});
$('clear').addEventListener('click',async()=>{
 if(!checkAdmin())return;
 if(!confirm('현재 게시판의 모든 학생 의견을 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;
 const confirmText=window.prompt('전체 삭제를 확인하려면 초기화 라고 입력하세요.');if(confirmText!=='초기화')return;
 try{
  // max 30 documents, one batch; keep total settings.
  const batch=DSDB.db.batch();submissions.forEach((v,n)=>batch.delete(DSDB.submissions.doc(String(n))));
  await batch.commit();selected=null;render();alert('학생 의견을 초기화했습니다. 전체 인원수 설정은 유지됩니다.');
 }catch(e){alert('초기화에 실패했습니다. Firebase 관리자 권한을 확인해 주세요.')}
});
