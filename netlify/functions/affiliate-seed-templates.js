// affiliate-seed-templates.js  (Playbook)
// Seeds affiliate_templates with the message library. Idempotent: wipes and reloads.
// Run manually after deploy (and after any library revision):
//   curl https://cute-cat-d9631c.netlify.app/.netlify/functions/affiliate-seed-templates
// Templates are DB rows after this - edit copy in the DB / page without redeploying.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opts.headers || {}) }
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// segment, step, channel, day_offset (days from cadence start), subject, body
const T = [];
const add = (segment, step, channel, day, subject, body) =>
  T.push({ segment, step_number: step, channel, day_offset: day, subject, body, active: true });

// ============ NEW_NEVER ============
add('new_never', 1, 'email', 0, 'Your referral link works. Here is the 60 second version.',
`Hey {first_name},

You are set up on our end. Before anything else, here is the one thing most new partners ask for: what do I actually say to someone?

Steal this word for word:

"I know a team that gets people approval ready, usually in 60 to 90 days. They only charge for results and they will tell you for free if they can help. Want me to send you the link?"

That is it. Then send them here: {portal_link}

Every client you send gets a free consultation whether they sign up or not, so you are never putting your name on something that costs them anything to check out.

One question so I can actually be useful to you: how often are you running into clients with credit issues? Weekly? Every day? Reply with a number and I will send you the exact talk track for the situation you see most.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 2, 'sms', 3, null,
`Hey {first_name}, it is {consultant_name} with ASAP. Your referral link is live. If a client ever gets declined or told to come back when their credit is better, that is the moment. Send them your link and we take it from there: {portal_link} (Reply STOP to opt out)`);

add('new_never', 3, 'call', 7, null,
`Their company and occupation are on the affiliate card. Review BEFORE dialing, never ask what they do.
- Thank them for signing up, reference their business: "I saw you are over at {company}"
- Ask: "How often are you running into people with credit problems in your line of work?"
- Give the play for their answer: lender = declined apps, realtor = pre-approval falls through, dealer = turned down at the desk, tax or insurance pro = clients who mention debt
- Offer to send the word for word script for that situation
- Do NOT ask them to commit to anything. End with "the first one is the hardest, after that it is muscle memory"`);

add('new_never', 4, 'email', 14, 'The 40 point client',
`{first_name},

Quick story because it is the fastest way to show you what happens after you send someone.

A partner sent us a client who had been declined for a business loan. Mid 500s score, two collections he did not even know were his, and a maxed card that was 90 percent of the damage. We disputed the collections with documentation, coached him on the card, and 74 days later he was 40 plus points higher and back at the same lender with an approval.

The partner did exactly one thing: sent a link.

That is the whole job on your side. We do the work, the client gets results, and you get paid on every one who signs up. And the ceiling is higher than most partners expect: some of our top producing partners earn over $10,000 a month from referrals alone.

Your link: {portal_link}

Who is the last person that came to mind while you read that? Send them the link today.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 5, 'sms', 21, null,
`{first_name}, one question: have you run into anyone yet who got declined or needs a better score to qualify? If yes, your link does all the work: {portal_link}. If you have not, no stress, they will show up. When they do you are ready. {consultant_name}`);

add('new_never', 6, 'call', 30, null,
`Honest check in, uncover the blocker, offer a done for you assist.
- "Not calling to push, calling to make this easier"
- Ask what has gotten in the way: no candidates yet? Not sure who fits? Awkward to bring up?
- Offer the assist: "If you have someone in mind but the conversation feels weird, intro us by text or email and we take the whole conversation from there. You literally just make the intro."
- Confirm their preferred channel going forward`);

// ============ DORMANT ============
add('dormant', 1, 'email', 0, 'It has been a while, and that is on us',
`Hey {first_name},

I was going through our partner list and realized your last client with us was back in {last_referral_month}. You have sent us {sold_clients} over time, and I do not want the silence since then to be because we dropped the ball somewhere.

So, honest question, no pitch attached: did something change on your end, or did we do something that made you stop sending people our way? If it is the second one I genuinely want to know.

Two things that are new since {last_referral_month}, in case they matter to your clients:
1. Progress Reports now go out to clients on a set schedule, so the people you refer are never in the dark about where things stand.
2. Turnaround on first round results is tighter than it was, most clients see first movement inside 45 days.

Either way, good to reconnect. Reply to this and it comes straight to me.

{consultant_name}
ASAP Credit & Financial Services`);

add('dormant', 2, 'sms', 4, null,
`Hey {first_name}, {consultant_name} from ASAP. Sent you an email but texts are easier. You sent us {sold_clients} great clients and then things went quiet on our side of the fence too. Anything we could be doing better for you or your clients? Straight answers welcome. (Reply STOP to opt out)`);

add('dormant', 3, 'call', 10, null,
`This is the important handoff conversation. Listen 80 percent.
- Open with appreciation, be specific: "{sold_clients} clients came through you"
- Ask the real question: "What would make it a no brainer to send the next one?"
- Listen for: bad client experience, payout confusion, they changed roles, a competitor
- If bad experience: get the client name, promise to run it down personally, then actually do it
- If payout: confirm their payout method on file, fix anything stale
- Give before leaving: offer the partner one pager or a co branded piece they can hand clients`);

// ============ SLOWING ============
add('slowing', 1, 'email', 0, 'Checking in on your people',
`{first_name},

Your last client came through in {last_referral_month} and I wanted to check two boxes with you.

One, if you ever want a status update on anyone you have sent us, ask me directly. You put your name on them, you should never wonder how it is going.

Two, a small thing that helps your future referrals convert: the clients who sign up fastest are the ones told one sentence up front, "they only charge per item fixed, and the consultation costs nothing." When people hear that before they click, they show up ready instead of skeptical.

Nothing needed from you. Door is open.

{consultant_name}
ASAP Credit & Financial Services`);

add('slowing', 2, 'sms', 10, null,
`{first_name}, it is {consultant_name}. If anyone in your world got a no this month because of their credit, that is our lane. Send them your link and I will personally keep you posted on how they do: {portal_link} (Reply STOP to opt out)`);

add('slowing', 3, 'call', 21, null,
`Relationship maintenance plus one conversion idea.
- Check in on their business first, actually listen
- Ask if any referrals they sent did NOT sign up, offer to look into why and take another run at them
- Share their conversion picture if useful: "{sold_clients} of your {referred_deals} referrals became clients, want to talk about what happened with the rest?"`);

// ============ PRODUCING (monthly appreciation only) ============
add('producing', 1, 'email', 0, 'Your clients this month',
`{first_name},

Quick partner update, then I will get out of your way.

You have {sold_clients} clients with us all time, and your most recent came through in {last_referral_month}. Thank you. Referrals are trust, and we do not take yours lightly.

Two standing offers, every month, always true:
1. Want a status rundown on anyone you have sent? Reply with their name and you will have it same day.
2. Anything making referrals harder than it should be? Payout questions, a client experience that bugged you, a tool you wish existed? Tell me and I will fix what I can and be straight about what I cannot.

That is it. No ask. Keep sending people who need to get approval ready and we will keep making you look good for it.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ COLD (email only, monthly) ============
add('cold', 1, 'email', 0, 'You signed up with us a while back',
`Hey {first_name},

You created a referral account with us at some point and never sent anyone, which usually means one of three things: you forgot, you never ran into the right person, or you were never sure what we actually do for people.

The 15 second version: when someone gets declined for a loan, a mortgage, a car, or an apartment because of their credit, we get them approval ready. Free consultation, work billed per item fixed, most people see first movement inside 45 days, usually fully approval ready in 60 to 90 days.

You get paid on every person you send who signs up. Your link still works: {portal_link}

If this is not for you, the unsubscribe link below removes you and we will not take it personally.

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 2, 'email', 30, 'The moment to remember us',
`{first_name},

One idea, then I am gone.

You do not need to go find people with credit problems. You need to remember one sentence for the moment someone mentions one. That moment sounds like: "I got turned down," "my score tanked," "we have to wait until my credit is better."

The sentence: "I know a team that fixes exactly that, want the link?"

Then you send: {portal_link}

That is the entire business of being our partner. One remembered sentence.

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 3, 'email', 60, 'What partners actually earn',
`{first_name},

Real talk about the money since we have never discussed it.

Some of our top producing partners earn over $10,000 a month from referrals alone. That is the ceiling, not the average, but it is real and it is paid monthly. Partners get paid on every referred client who signs up. Our most active partners are not marketers, they are lenders, realtors, dealers, and tax pros who simply route the people they were already turning away. The clients they could not help become clients they got paid on, and those same clients come BACK to them approval ready, which means deals that closed instead of dying.

That last part is the piece most people miss. You are not sending business away. You are recycling your own declines into future closings.

Your link: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

// ============ ROTATION (monthly value pieces, all segments after their sequence) ============
add('rotation', 1, 'email', 30, 'The three fastest score killers',
`{first_name},

Three things do most of the damage on the credit reports we see, and knowing them helps you spot the people worth sending our way.

1. Maxed out revolving cards. Utilization is a third of the score. Someone carrying a card at its limit is often 40 or more points below where they could be.
2. Small collections people ignore. A $87 medical collection drags a file the same way a big one does. People assume small = harmless. It is not.
3. Late payments inside the last 24 months. Recency matters more than count. One recent late outweighs three old ones.

When someone mentions any of these, that is your moment: "I know a team that fixes exactly that, want the link?" {portal_link}

Forward this to anyone it would help.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 2, 'email', 30, 'What to tell someone who says credit repair is a scam',
`{first_name},

Sooner or later someone you refer will say it: "is that not a scam?"

The honest answer: a lot of the industry is. Here is what you can say about us, because every word is verifiable.

We have been doing this for 13 years and served over 67,000 clients at a 4.9 star average. The consultation is free and we tell people straight up if we cannot help. Billing is per item actually resolved, not a monthly fee that rewards slowness. And clients get Progress Reports on a schedule, so they always know what is happening.

Skeptics make great clients once they see documentation instead of promises. Send them anyway: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 3, 'email', 30, 'The 60 to 90 day timeline, explained',
`{first_name},

The number one question referred clients ask: how long does this take? Here is the honest timeline so you can set expectations that we will actually meet.

First 45 days: analysis, dispute round one, and usually the first visible movement.
Days 45 to 90: second round, responses come back, scores step up as items resolve.
By 60 to 90 days: most clients are approval ready for what they were originally declined for.

Some files run faster, complicated ones run longer, and we tell each client which they are after the free consultation.

Accurate expectations make you look good twice: when you refer, and when it plays out exactly like you said. {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 4, 'email', 30, 'Your declined clients are worth more than you think',
`{first_name},

The partners who earn the most with us all figured out the same thing: a decline is not the end of a deal, it is a 60 to 90 day pause.

The loop works like this. A client gets declined because of their credit. Instead of losing them forever, you send them one text: "I know a team that can get you approval ready, want the link?" They work with us, and in 60 to 90 days they come back to you qualified. You get paid on the referral AND you close the deal that was dead.

You are not sending business away. You are recycling your own declines into future closings.

Your link, whenever the moment shows up: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 5, 'email', 30, 'One question that opens the conversation',
`{first_name},

Here is the softest referral opener we know, and it works because it is genuinely useful:

"Out of curiosity, do you know what is actually on your credit report?"

Most people do not. And the gap between what they think is there and what is actually there is where every referral comes from. Collections they never knew existed, a late payment from a bill that went to an old address, a balance reporting wrong.

You are not selling anything by asking. You are being the person who helped them look. And when they find something: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 6, 'email', 30, 'We answer to you, not just the client',
`{first_name},

One standing offer worth repeating, because partners forget it exists.

Any client you have EVER sent us: reply with their name and you get a real status rundown the same day. Not a portal login, not a canned update. The actual picture.

You put your name on these people. Partners who check in on their referrals convert more future ones, because the people they refer can tell someone is actually watching out for them.

That is the whole email. The offer never expires.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 7, 'email', 30, 'What the top of the partner board looks like',
`{first_name},

We looked at what our highest earning partners do differently, and it is less impressive than you would hope. That is good news.

They mention us IN the decline conversation, not weeks later. The moment someone hears no, they hear "and here is what you can do about it" in the same breath.
They send the link in the same text. No "I will connect you later." Later never comes.
They check on their people afterward, which makes the next referral easier because the last one felt taken care of.

That is the entire playbook. Our top partners earn over $10,000 a month and there is no trick to it. They simply send the most people.

Your link: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

exports.handler = async () => {
  try {
    const del = await supa('affiliate_templates?id=gt.0', { method: 'DELETE' });
    if (!del.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'wipe failed: ' + del.text.slice(0, 200) }) };
    let inserted = 0;
    for (let c = 0; c < T.length; c += 50) {
      const chunk = T.slice(c, c + 50);
      const ins = await supa('affiliate_templates', { method: 'POST', body: JSON.stringify(chunk) });
      if (!ins.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'insert failed: ' + ins.text.slice(0, 200), inserted }) };
      inserted += chunk.length;
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, templates: inserted }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
