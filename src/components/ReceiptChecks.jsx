import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './ReceiptChecks.css'

const normalize = (n) => (n || '').replace(/\s/g, '').toUpperCase()

// What staff should know before verifying an official receipt (shown on the
// request pages and the Official Receipts list):
//   - its receipt number,
//   - the group it belongs to when one receipt was applied to several
//     requests, with the total the receipt has to show (verifying or
//     rejecting one applies to all of them -- see the receipt safeguards
//     migration),
//   - warnings when the same photo or receipt number is on another request.
// Degrades to just the number before that migration is applied.
function ReceiptChecks({ receipt, compact = false }) {
    const [group, setGroup] = useState([])
    const [samePhoto, setSamePhoto] = useState([])
    const [sameNumber, setSameNumber] = useState([])

    const receiptId = receipt?.receipt_id
    const groupId = receipt?.receipt_group_id
    const fileHash = receipt?.file_hash
    const number = normalize(receipt?.receipt_number)

    useEffect(() => {
        if (!receiptId) return undefined
        let cancelled = false

        const load = async () => {
            const [groupRes, photoRes, numberRes] = await Promise.all([
                groupId
                    ? supabase.from('official_receipts').select('receipt_id, request_id').eq('receipt_group_id', groupId)
                    : Promise.resolve({ data: [] }),
                fileHash
                    ? supabase.from('official_receipts').select('receipt_id, request_id, receipt_group_id').eq('file_hash', fileHash).neq('receipt_id', receiptId)
                    : Promise.resolve({ data: [] }),
                number
                    ? supabase.from('official_receipts').select('receipt_id, request_id, receipt_group_id, receipt_number').ilike('receipt_number', `%${number.slice(-6)}%`).neq('receipt_id', receiptId)
                    : Promise.resolve({ data: [] }),
            ])

            const inGroup = (r) => groupId && r.receipt_group_id === groupId
            const photoRows = (photoRes.data || []).filter((r) => !inGroup(r))
            const numberRows = (numberRes.data || []).filter((r) => !inGroup(r) && normalize(r.receipt_number) === number)
            const groupRows = groupRes.data || []

            const requestIds = [...new Set([...groupRows, ...photoRows, ...numberRows].map((r) => r.request_id))]
            const { data: requests } = requestIds.length
                ? await supabase.from('document_requests').select('request_id, request_number, total_amount').in('request_id', requestIds)
                : { data: [] }
            const byId = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))
            const toRequests = (rows) => [...new Set(rows.map((r) => r.request_id))].map((id) => byId[id]).filter(Boolean)

            if (cancelled) return
            setGroup(groupRows.length > 1 ? toRequests(groupRows) : [])
            setSamePhoto(toRequests(photoRows))
            setSameNumber(toRequests(numberRows))
        }

        load().catch((err) => console.warn('RECEIPT CHECKS ERROR:', err))
        return () => {
            cancelled = true
        }
    }, [receiptId, groupId, fileHash, number])

    if (!receipt) return null

    const groupTotal = group.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
    const list = (rows) => rows.map((r) => r.request_number).join(', ')

    return (
        <div className={`receipt-checks${compact ? ' is-compact' : ''}`}>
            {!compact && (
                <div className="receipt-checks-number">
                    <span>Receipt number</span>
                    <strong>{receipt.receipt_number || 'Not provided'}</strong>
                </div>
            )}

            {group.length > 1 && (
                <div className="receipt-check is-group">
                    <strong>One receipt for {group.length} requests</strong>
                    <p>
                        This receipt covers {list(group)} — total <b>₱{groupTotal.toFixed(2)}</b>. Check that the receipt
                        shows ₱{groupTotal.toFixed(2)}. Verifying or rejecting applies to all of them.
                    </p>
                </div>
            )}

            {samePhoto.length > 0 && (
                <div className="receipt-check is-warning">
                    <strong>Same photo used on another request</strong>
                    <p>The identical file was also uploaded for {list(samePhoto)}. Make sure it isn't being reused.</p>
                </div>
            )}

            {sameNumber.length > 0 && (
                <div className="receipt-check is-warning">
                    <strong>Receipt number used on another request</strong>
                    <p>Receipt number {receipt.receipt_number} also appears on {list(sameNumber)}.</p>
                </div>
            )}
        </div>
    )
}

export default ReceiptChecks
