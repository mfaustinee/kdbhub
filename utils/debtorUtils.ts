import { DebtorRecord, ClientReturn, LicensedClient, ArrearItem, Installment } from '../types';
import { numberToWords } from './numberToWords';

/**
 * Determines whether a client return has an unpaid or outstanding amount.
 */
export const isReturnUnpaid = (ret: ClientReturn): boolean => {
  if (!ret) return false;
  const outBal = Number(ret.outstandingBalance || 0);
  if (outBal > 0) return true;

  const invAmt = Number(ret.invoiceAmount || 0);
  const payAmt = Number(ret.paymentAmount || 0);
  const status = String(ret.paymentStatus || '').trim().toLowerCase();

  if (status.includes('unpaid') || status.includes('pending') || status.includes('overdue') || status.includes('partial') || status.includes('arrear')) {
    return true;
  }

  if (invAmt > payAmt && !status.includes('paid in full') && !status.includes('fully paid') && status !== 'paid') {
    return true;
  }

  return false;
};

/**
 * Calculates the exact outstanding arrears amount for a return.
 */
export const getReturnOutstandingAmount = (ret: ClientReturn): number => {
  if (!ret) return 0;
  const outBal = Number(ret.outstandingBalance || 0);
  if (outBal > 0) return outBal;

  const invAmt = Number(ret.invoiceAmount || 0);
  const payAmt = Number(ret.paymentAmount || 0);
  const lessCf = Number(ret.lessCF || 0);

  const diff = invAmt - payAmt - lessCf;
  if (diff > 0) return diff;

  if (isReturnUnpaid(ret) && invAmt > 0) {
    return invAmt;
  }

  return 0;
};

/**
 * Integrates all unpaid entries from returns into the Debtors ledger, ensuring every
 * debtor with outstanding arrears is reflected, fully populated, and ready for payment agreement
 * and/or dispute resolution.
 */
export const integrateUnpaidReturnsIntoDebtors = (
  baseDebtors: DebtorRecord[] = [],
  returns: ClientReturn[] = [],
  clients: LicensedClient[] = []
): DebtorRecord[] => {
  const integrated: DebtorRecord[] = JSON.parse(JSON.stringify(baseDebtors || []));
  
  // Group unpaid returns by client
  const unpaidByClient: Record<string, { clientName: string; returns: ClientReturn[] }> = {};

  (returns || []).forEach(ret => {
    if (!ret) return;
    if (isReturnUnpaid(ret)) {
      const outAmount = getReturnOutstandingAmount(ret);
      if (outAmount <= 0) return;

      const cKey = (ret.clientId || ret.clientName || '').trim().toLowerCase();
      if (!cKey) return;

      if (!unpaidByClient[cKey]) {
        unpaidByClient[cKey] = {
          clientName: ret.clientName,
          returns: []
        };
      }
      unpaidByClient[cKey].returns.push(ret);
    }
  });

  // Process grouped unpaid returns
  Object.entries(unpaidByClient).forEach(([clientKey, group]) => {
    const rets = group.returns;
    if (!rets || rets.length === 0) return;

    // Lookup matching client in clients registry
    const matchedClient = (clients || []).find(c => {
      if (!c) return false;
      const cId = (c.id || '').trim().toLowerCase();
      const cName = (c.clientName || '').trim().toLowerCase();
      const cPermit = (c.permitNumber || '').trim().toLowerCase();
      return cId === clientKey || cName === clientKey || cPermit === clientKey;
    });

    const clientName = matchedClient ? matchedClient.clientName : (group.clientName || rets[0]?.clientName || 'Unknown Operator');
    const premiseName = matchedClient ? (matchedClient.premiseName || 'Main Premise') : 'Main Premise';
    const permitNo = matchedClient 
      ? (matchedClient.permitNumber || `KDB/LC/${matchedClient.id || clientKey}`) 
      : `KDB/LC/${rets[0]?.clientId || clientKey.toUpperCase()}`;
    const location = matchedClient ? matchedClient.location : 'Regulatory Zone';
    const county = matchedClient ? matchedClient.county : 'Kenya';
    const tel = matchedClient ? (matchedClient.tel || 'No Phone') : 'No Phone';
    const clientId = matchedClient ? matchedClient.id : (rets[0]?.clientId || clientKey);

    // Build ArrearItem list
    const arrearsBreakdown: ArrearItem[] = rets.map((r, idx) => {
      const amount = getReturnOutstandingAmount(r);
      const periodLabel = `${r.period || 'General'} ${r.year || ''}`.trim();
      return {
        id: `ret-arr-${r.id || `${r.year}-${r.period}-${idx}`}`,
        month: periodLabel,
        amount
      };
    });

    const totalArrears = arrearsBreakdown.reduce((sum, item) => sum + item.amount, 0);
    const totalArrearsWords = numberToWords(totalArrears);
    const arrearsPeriod = arrearsBreakdown.map(b => b.month).join(', ');

    // Check if debtor already exists in integrated list
    const existingIndex = integrated.findIndex(d => {
      const dName = (d.dboName || '').toLowerCase().trim();
      const dPermit = (d.permitNo || '').toLowerCase().trim();
      const dId = (d.id || '').toLowerCase().trim();
      return (
        dName === clientName.toLowerCase().trim() ||
        dPermit === permitNo.toLowerCase().trim() ||
        dId === clientId.toLowerCase().trim()
      );
    });

    if (existingIndex !== -1) {
      // Merge with existing record
      const existing = integrated[existingIndex];
      const mergedBreakdown: ArrearItem[] = [...(existing.arrearsBreakdown || [])];

      arrearsBreakdown.forEach(arr => {
        const found = mergedBreakdown.find(b => (b.month || '').toLowerCase() === (arr.month || '').toLowerCase());
        if (found) {
          found.amount = Math.max(found.amount, arr.amount);
        } else {
          mergedBreakdown.push(arr);
        }
      });

      const newTotal = mergedBreakdown.reduce((sum, item) => sum + item.amount, 0);
      const newTotalWords = numberToWords(newTotal);

      let finalInstallments = existing.installments || [];
      if (finalInstallments.length <= 1 || existing.debitNoteNo?.startsWith('DN/RET/')) {
        finalInstallments = mergedBreakdown.map((item, idx) => ({
          no: idx + 1,
          period: item.month,
          dueDate: new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          amount: item.amount
        }));
      }

      integrated[existingIndex] = {
        ...existing,
        dboName: existing.dboName || clientName,
        premiseName: existing.premiseName || premiseName,
        permitNo: existing.permitNo || permitNo,
        location: existing.location || location,
        county: existing.county || county,
        tel: existing.tel || tel,
        arrearsBreakdown: mergedBreakdown,
        totalArrears: newTotal,
        totalArrearsWords: newTotalWords,
        arrearsPeriod: mergedBreakdown.map(b => b.month).join(', '),
        installments: finalInstallments
      };
    } else {
      // Create fresh debtor record ready for Payment Agreement or Resolution
      const installments: Installment[] = arrearsBreakdown.map((item, idx) => ({
        no: idx + 1,
        period: item.month,
        dueDate: new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: item.amount
      }));

      integrated.push({
        id: clientId || `D_${Math.random().toString(36).substr(2, 6)}`,
        dboName: clientName,
        premiseName,
        permitNo,
        location,
        county,
        tel,
        arrearsBreakdown,
        totalArrears,
        totalArrearsWords,
        arrearsPeriod,
        debitNoteNo: `DN/RET/${permitNo.replace(/[^a-zA-Z0-9]/g, '')}`,
        installments
      });
    }
  });

  // Deduplicate by ID and permit
  const uniqueDebtors = Array.from(new Map(integrated.map(d => [d.id || d.permitNo, d])).values());
  return uniqueDebtors;
};
