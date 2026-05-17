// WhatsApp message templates - English + Pashto stacked.
// Variables: {name}, {amount}, {date}, {balance}, {items_list}, {paid},
//            {count}, {weight}, {price}, {unit}, {farm_name}, {bill}, {advance}

export const STORE_SIGNATURE = {
  en: 'Royani Poultry Supply Store',
  ps: 'رویاني د چرګانو د اکمالاتو پلورنځی',
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې توکي نن ستاسو فارم ته ولېږل شول.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

ستاسو زمونږ سره له کاروباره مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

ستاسو د پر وخت تادیې څخه مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې مبلغ نن ستاسو حساب ته تادیه شو.

ورکړل شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې پاتې قرض: {balance} افغانۍ.

ستاسو د دوامدارې همکارۍ څخه مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې توکي نن له تاسو څخه ترلاسه شول.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}
اوسنی ټول قرض: {balance} افغانۍ.

مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم مشتري،

ستاسو د ننۍ خرید څخه مننه.

توکي: {items_list}
ورکړل شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
حالت: بشپړ تادیه شوی

ستاسو زمونږ سره له کاروباره مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

ستاسو د ننۍ خرید څخه مننه.

توکي: {items_list}
ټول مبلغ: {amount} افغانۍ
ورکړل شوی مبلغ: {paid} افغانۍ
پاتې حساب: {balance} افغانۍ
نېټه: {date}

ستاسو زمونږ سره له کاروباره مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
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
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې لاندې چرګان نن ستاسو مارکېټ ته ولېږل شول.

د چرګانو شمېر: {count}
له فارم څخه: {farm_name}
د بل نمبر: {bill}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}

مهرباني وکړئ ترلاسه کول تایید کړئ او د خرڅلاو معلومات له موږ سره شریک کړئ.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن ستاسو د فارم {count} چرګان د خرڅلاو لپاره بازار پلورونکي ته ولېږل شول.

لیږل شوي چرګان: {count}
د بازار پلورونکی: {seller_name}
د بل نمبر: {bill}
ټول مبلغ: {amount} افغانۍ
نېټه: {date}

د خرڅلاو له بشپړیدو وروسته به تاسو خبر کړو.
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې ستاسو تادیه نن ترلاسه شوه.

ترلاسه شوی مبلغ: {amount} افغانۍ.
نېټه: {date}
پاتې حساب: {balance} افغانۍ.

مننه.
${STORE_SIGNATURE.ps}`,
  },

  // 12. Outstanding balance reminder
  balance_reminder: {
    en:
`Dear {name},

This is a friendly reminder regarding your outstanding balance with us.

Outstanding balance: {amount} AFN
As of: {date}

Please arrange payment at your earliest convenience.

Thank you,
${STORE_SIGNATURE.en}`,
    ps:
`محترم {name}،

دا ستاسو د پاتې حساب په اړه یو دوستانه یادونه ده.

پاتې حساب: {amount} افغانۍ.
تر نېټې: {date}

مهرباني وکړئ خپل تادیه ژر تر ژره تنظیم کړئ.

مننه،
${STORE_SIGNATURE.ps}`,
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
${STORE_SIGNATURE.en}`,
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
${STORE_SIGNATURE.ps}`,
  },

  // 14. Cash Ledger — money we gave to a person
  cash_given: {
    en:
`Dear {name},

We confirm that we have given you {amount} AFN today.

Date: {date}
Total amount you owe us: {balance} AFN

Royani Poultry Supply Store`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن مو تاسو ته {amount} افغانۍ درکړې.

نېټه: {date}
هغه ټوله پیسه چې تاسو موږ ته لرئ: {balance} افغانۍ

رویاني د چرګانو د اکمالاتو پلورنځی`,
  },

  // 15. Cash Ledger — money we received from a person
  cash_received: {
    en:
`Dear {name},

We confirm that we have received {amount} AFN from you today.

Date: {date}
Remaining balance: {balance} AFN

Royani Poultry Supply Store`,
    ps:
`محترم {name}،

په دې سره تاییدوو چې نن مو له تاسو څخه {amount} افغانۍ ترلاسه کړې.

نېټه: {date}
پاتې حساب: {balance} افغانۍ

رویاني د چرګانو د اکمالاتو پلورنځی`,
  },
}

// Replace {placeholders} with values
function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined && vars[key] !== null && vars[key] !== '' ? String(vars[key]) : match
  })
}

// Build the combined English + Pashto message for sending via WhatsApp
export function buildWhatsAppMessage(templateKey, vars) {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  const en = fillTemplate(tpl.en, vars)
  const ps = fillTemplate(tpl.ps, vars)
  return `${en}${SEPARATOR}${ps}`
}

// Get just one language (for preview / editing)
export function getMessage(templateKey, vars, lang = 'en') {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  return fillTemplate(tpl[lang] || tpl.en, vars)
}
