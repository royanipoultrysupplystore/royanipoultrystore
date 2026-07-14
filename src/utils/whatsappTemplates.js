// WhatsApp message templates - English + Pashto stacked.
// Variables: {name}, {amount}, {date}, {balance}, {items_list}, {paid},
//            {count}, {weight}, {price}, {unit}, {farm_name}, {bill}, {advance}
// The {store} placeholder is the business name (filled per-language at build time).

// Mutable store signature — set from SettingsContext once the business name loads.
// Defaults keep existing behaviour if settings haven't loaded yet.
let storeNameEn = 'Royani Poultry Supply Store'
let storeNamePs = 'رویاني د چرګانو د اکمالاتو پلورنځی'

export function setStoreSignature(en, ps) {
  if (en) storeNameEn = en
  if (ps) storeNamePs = ps
}

const SEPARATOR = '\n\n────────────\n\n'

export const WA_TEMPLATES = {
  // 1. Dispatch sent to farm (medicine / feed / choza)
  farm_dispatch: {
    en:
`Dear {name},

We confirm that the following items have been dispatched to your farm today.

Items: {items_list}
Total amount: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې توکي نن ستاسو فارم ته ولېږل شول.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

ستاسو زمونږ سره له کاروباره مننه.
{store}`,
  },

  // 2. Payment received from farm
  farm_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you for your prompt payment.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

ستاسو د پر وخت تادیې څخه مننه.
{store}`,
  },

  // 3. Payment made to supplier
  supplier_payment_made: {
    en:
`Dear {name},

We confirm that we have paid the following amount to your account today.

Amount paid: {amount} AFN
Date: {date}
Remaining balance owed to you: {balance} AFN

Thank you for your continued partnership.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې مبلغ نن ستاسو حساب ته تادیه شو.

ورکړل شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې پاتې قرض: {balance} افغانۍ.

ستاسو د دوامدارې همکارۍ څخه مننه.
{store}`,
  },

  // 4. Goods received from supplier
  supplier_goods_received: {
    en:
`Dear {name},

We confirm that we have received the following goods from you today.

Items: {items_list}
Total amount: {amount} AFN
Date: {date}
Total now owed to you: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې توکي نن له تاسو څخه ترلاسه شول.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}
اوسنی ټول قرض: {balance} افغانۍ.

مننه.
{store}`,
  },

  // 5. POS / walk-in sale - paid in full
  pos_sale_paid: {
    en:
`Dear customer,

Thank you for your purchase today.

Items: {items_list}
Total paid: {amount} AFN
Date: {date}
Status: Paid in full

Thank you for doing business with us.
{store}`,
    ps:
`محترم مشتري،

ستاسو د ننۍ خرید څخه مننه.

توکي: {items_list}
ورکړل شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
حالت: بشپړ تادیه شوی

ستاسو زمونږ سره له کاروباره مننه.
{store}`,
  },

  // 6. POS / walk-in sale - partial or unpaid (credit)
  pos_sale_credit: {
    en:
`Dear {name},

Thank you for your purchase today.

Items: {items_list}
Total: {amount} AFN
Amount paid: {paid} AFN
Outstanding balance: {balance} AFN
Date: {date}

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

ستاسو د ننۍ خرید څخه مننه.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
ورکړل شوی مبلغ: {paid} افغانۍ
پاتې حساب: {balance} افغانۍ
نېټه: {date}

ستاسو زمونږ سره له کاروباره مننه.
{store}`,
  },

  // 7. Walk-in customer payment received
  walkin_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
{store}`,
  },

  // 8. Commission sale (chickens sold)
  commission_sale: {
    en:
`Dear {name},

Thank you for your purchase today.

Chickens: {count}
Weight: {weight} kg
Price: {price} AFN per {unit}
Total: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

ستاسو د ننۍ خرید څخه مننه.

د چرګانو شمېر: {count}
وزن: {weight} کیلو
قیمت: {price} افغانۍ فی {unit}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

ستاسو زمونږ سره له کاروباره مننه.
{store}`,
  },

  // 9. Commission customer payment received
  commission_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
{store}`,
  },

  // 10. Chickens sent to market seller
  market_chickens_sent: {
    en:
`Dear {name},

We confirm that the following chickens have been sent to your market today.

Chickens: {count}
From farm: {farm_name}
Bill number: {bill}
Total amount: {amount} AFN
Date: {date}

Please confirm receipt and update us with the sale details.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې چرګان نن ستاسو مارکېټ ته ولېږل شول.

د چرګانو شمېر: {count}
له فارم څخه: {farm_name}
د بل نمبر: {bill}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}

مهرباني وکړئ ترلاسه کول تایید کړئ او د خرڅلاو معلومات له موږ سره شریک کړئ.
{store}`,
  },

  // 10b. Farm owner — their chickens sent to a market seller
  farm_chickens_to_market: {
    en:
`Dear {name},

We confirm that {count} chickens from your farm have been sent to a market seller today for sale.

Chickens sent: {count}
Market seller: {seller_name}
Bill number: {bill}
Total amount: {amount} AFN
Date: {date}

We will update you once the sale is completed.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن ستاسو د فارم {count} چرګان د خرڅلاو لپاره بازار پلورونکي ته ولېږل شول.

لیږل شوي چرګان: {count}
د بازار پلورونکی: {seller_name}
د بل نمبر: {bill}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}

د خرڅلاو له بشپړیدو وروسته به تاسو خبر کړو.
{store}`,
  },

  // 11. Payment received from market seller
  market_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
{store}`,
  },

  // 12. Outstanding balance reminder
  // 12a. Cash Ledger — LENT (we gave money to the person; they owe us).
  //      Sent right after recording a "lent" transaction.
  cash_ledger_lent: {
    en:
`Dear {name},

We confirm that the following amount was lent to you today.

Amount: {amount} AFN
Date: {date}
Total balance owed to us: {balance} AFN

Please arrange repayment at your convenience.

Thank you,
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې مبلغ نن تاسو ته پور ورکړل شو.

مبلغ: {amount} افغانۍ.
نېټه: {date}
د مونږ سره ستاسو ټول پور: {balance} افغانۍ.

مهرباني وکړئ خپل تادیه ژر تر ژره تنظیم کړئ.

مننه،
{store}`,
  },

  // 12b. Cash Ledger — BORROWED (we took money from the person; we owe them).
  //      Sent right after recording a "borrowed" transaction.
  cash_ledger_borrowed: {
    en:
`Dear {name},

We confirm that we received the following amount from you today.

Amount: {amount} AFN
Date: {date}
Total balance we owe you: {balance} AFN

Thank you for your continued trust.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې مبلغ نن ستاسو څخه ترلاسه شو.

مبلغ: {amount} افغانۍ.
نېټه: {date}
د مونږ لخوا ستاسو ټول پور: {balance} افغانۍ.

ستاسو د دوامدارې اعتماد څخه مننه.
{store}`,
  },

  // 12c. Cash Ledger — outstanding balance reminder (either direction).
  //      Manually triggered from the person profile.
  cash_ledger_reminder: {
    en:
`Dear {name},

This is a friendly reminder regarding your Cash Ledger balance with us.

Outstanding balance: {amount} AFN
As of: {date}

Please arrange settlement at your earliest convenience.

Thank you,
{store}`,
    ps:
`محترم {name}،

دا ستاسو د نغدو کتاب په اړه یو دوستانه یادونه ده.

پاتې حساب: {amount} افغانۍ.
تر نېټې: {date}

مهرباني وکړئ خپل حساب ژر تر ژره تصفیه کړئ.

مننه،
{store}`,
  },

  balance_reminder: {
    en:
`Dear {name},

This is a friendly reminder regarding your outstanding balance with us.

Outstanding balance: {amount} AFN
As of: {date}

Please arrange payment at your earliest convenience.

Thank you,
{store}`,
    ps:
`محترم {name}،

دا ستاسو د پاتې حساب په اړه یو دوستانه یادونه ده.

پاتې حساب: {amount} افغانۍ.
تر نېټې: {date}

مهرباني وکړئ خپل تادیه ژر تر ژره تنظیم کړئ.

مننه،
{store}`,
  },

  // 13. Initial chicken delivery to a farm
  farm_chickens_delivered: {
    en:
`Dear {name},

We confirm that we have delivered chickens to your farm today.

Chickens delivered: {count}
Price per chicken: {price} AFN
Total amount: {amount} AFN
Advance payment received: {advance} AFN
Outstanding balance: {balance} AFN
Date: {date}

We wish you success with this batch.
{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن چرګان ستاسو فارم ته وسپارل شول.

سپارل شوي چرګان: {count}
د هر چرګ قیمت: {price} افغانۍ
ټول مبلغ: {amount} افغانۍ
ترلاسه شوی مخکینۍ تادیه: {advance} افغانۍ
پاتې حساب: {balance} افغانۍ.
نېټه: {date}

موږ تاسو ته په دې دورۀ کې د بریا هیله کوو.
{store}`,
  },

  // 14. Cash Ledger — money we gave to a person
  cash_given: {
    en:
`Dear {name},

We confirm that we have given you {amount} AFN today.

Date: {date}
Total amount you owe us: {balance} AFN

{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن مو تاسو ته {amount} افغانۍ درکړې.

نېټه: {date}
هغه ټوله پیسه چې تاسو موږ ته لرئ: {balance} افغانۍ

{store}`,
  },

  // 15. Cash Ledger — money we received from a person
  cash_received: {
    en:
`Dear {name},

We confirm that we have received {amount} AFN from you today.

Date: {date}
Remaining balance: {balance} AFN

{store}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن مو له تاسو څخه {amount} افغانۍ ترلاسه کړې.

نېټه: {date}
پاتې حساب: {balance} افغانۍ

{store}`,
  },
}

// Replace {placeholders} with values
function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined && vars[key] !== null && vars[key] !== '' ? String(vars[key]) : match
  })
}

// Build the combined English + Pashto message for sending via WhatsApp.
// {store} is filled with the business name in the matching language.
export function buildWhatsAppMessage(templateKey, vars) {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  const en = fillTemplate(tpl.en, { ...vars, store: storeNameEn })
  const ps = fillTemplate(tpl.ps, { ...vars, store: storeNamePs || storeNameEn })
  return `${en}${SEPARATOR}${ps}`
}

// Get just one language (for preview / editing)
export function getMessage(templateKey, vars, lang = 'en') {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  const store = lang === 'ps' ? (storeNamePs || storeNameEn) : storeNameEn
  return fillTemplate(tpl[lang] || tpl.en, { ...vars, store })
}
