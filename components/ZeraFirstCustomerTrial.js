'use client';

import {useState} from 'react';
import {selectZeraWork,summarizeZeraTrial} from '../lib/zera-first-customer-plan.mjs';

const statusLabels = {
  pending: 'Kanıt bekliyor',
  needsRevision: 'Düzeltme gerekiyor',
  passed: 'Prova kontrolü geçti'
};

export default function ZeraFirstCustomerTrial({findings}) {
  const ids = findings.map(item => item.id);
  const choices = selectZeraWork(ids, ids);
  const [selected, setSelected] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [records, setRecords] = useState({});
  const [lastRecorded, setLastRecorded] = useState(null);
  const plan = selectZeraWork(ids, selected);
  const delivery = summarizeZeraTrial(plan, records);

  function choose(next) {
    setSelected(next);
    setReviewed(false);
    setRecords({});
    setLastRecorded(null);
  }

  function recordResult(event, id) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = String(form.get('note') || '').trim();
    if (!note) return;
    setRecords(previous => ({...previous, [id]: {note, status: form.get('status')}}));
    setLastRecorded(id);
  }

  return <section aria-labelledby="zera-job-title">
    <h2 id="zera-job-title">Bunu biz çözelim</h2>
    <p>ZERA müşteri provası. Seçtiğin bulgular üzerinden teslim kapsamını, örnek taslakları ve doğrulama adımlarını gör.</p>
    <button type="button" onClick={() => choose(ids)} disabled={selected.length === ids.length}>Tüm işleri prova kapsamına al</button>
    <fieldset>
      <legend>Çözülmesini istediğin işler</legend>
      {choices.map(item => <div key={item.id}>
        <label><input type="checkbox" checked={selected.includes(item.id)} onChange={event => choose(
          event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id)
        )}/> {item.title}</label>
      </div>)}
    </fieldset>
    {plan.length > 0 && <>
      <h3>Seçilen teslim kapsamı</h3>
      <ol>{plan.map(item => <li key={item.id}>
        <h4>{item.title}</h4>
        <p><strong>ZERA’dan gereken</strong> {item.requires}</p>
        <p><strong>Teslim önizlemesi</strong> {item.draft}</p>
        <p><strong>Kabul ölçütü</strong> {item.accept}</p>
      </li>)}</ol>
      <button type="button" onClick={() => setReviewed(true)} disabled={reviewed}>Müşteri onayını prova et</button>
      {reviewed && <section aria-labelledby="zera-delivery-title">
        <h3 id="zera-delivery-title">Teslim ve yeniden ölçüm provası</h3>
        <p>Varsayımsal doğrulama sonucunu ve neyin kontrol edildiğini gir. Kayıtlar bu ekran açıkken tutulur. İş seçimini değiştirirsen yeni bir kapsam provası başlar.</p>
        <p>{delivery.passed}/{delivery.items.length} iş prova kontrolünden geçti.
          {delivery.ready ? ' Teslim provası tamamlandı.' : ` Açık iş: ${delivery.pending}.`}</p>
        {delivery.items.map(item => <details key={item.id}>
          <summary>{item.title} · {statusLabels[item.status]}</summary>
          <p><strong>Kontrol</strong> {item.accept}</p>
          {item.note && <p><strong>Kayıtlı prova notu</strong> {item.note}</p>}
          <form onSubmit={event => recordResult(event, item.id)}>
            <label>Prova sonucu{' '}
              <select name="status" defaultValue="needsRevision">
                <option value="needsRevision">Düzeltme gerekiyor</option>
                <option value="passed">Kontrol geçti</option>
              </select>
            </label>
            <label> Prova kanıtı veya gözlem notu{' '}
              <textarea name="note" required maxLength={500} rows={2}/>
            </label>
            <button type="submit">Prova kaydını işle</button>
          </form>
          {lastRecorded === item.id && <p role="status">
            {delivery.ready ? `${delivery.passed}/${delivery.items.length} iş prova kontrolünden geçti. Teslim provası tamamlandı.`
              : `${statusLabels[item.status]}. Açık iş: ${delivery.pending}.`}
          </p>}
        </details>)}
        <h3>Önce ve sonra ölçümü</h3>
        <p>20 Kasım başlangıç kaydı, incelenebilen Instagram bölümünde 59/80. Kalan 20 puanlık kapsam için harita, gönderi açıklamaları, sipariş akışı ve profil istatistikleri bekleniyor.</p>
        <p>Yeni ölçüm tarihli gerçek kanıt bekliyor. Yayın sonrası ilk kontrolde mobil yollar ve görünürlük işaretleri incelenir. 14 gün sonra varsa nitelikli DM, WhatsApp ve randevu talebi sayıları karşılaştırılır.</p>
        <p>Gerçek uygulama için ZERA’nın materyalleri ve yazılı kapsam onayı gerekiyor.</p>
      </section>}
    </>}
  </section>;
}
