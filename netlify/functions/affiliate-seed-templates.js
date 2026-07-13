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

// ============ NEW_NEVER (signed up recently, no clients yet) ============
add('new_never', 1, 'email', 0, 'Now that your portal is set up',
`Hey {first_name},

Now that your portal is set up, I wanted to check in and share a couple things that may be valuable for you.

The biggest one is the referral handoff. Every month we see two partners send us the same number of clients. One converts 60 to 70 percent. The other barely breaks 15. Same leads, same program, completely different results.

The difference is never luck. It is how the client gets introduced. A warm intro with a little context converts several times better than a link dropped in a text.

I will send you the exact playbook for that in a couple days. For now, just know this: when you run into someone struggling with credit, you do not need a pitch. You need one sentence and your portal link, and we take it from there: {portal_link}

Quick question so I can actually be useful to you: how often are you running into clients with credit issues? Weekly? Every day? Reply and let me know, and if there is anything you need from us to get going, I am right here.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 2, 'email', 4, 'The handoff that doubles your conversions',
`{first_name},

I promised you the handoff playbook. Here it is, and it is simpler than you think.

Picture two partners. Referrer A tells their client "you could try these guys, here is their website." Referrer B says "I know a team I personally trust. They work fast, I have seen them change lives. Can I introduce you?"

Referrer B converts three to four times more clients. Every single month.

Here is what our top partners do when they submit someone through the portal:

They tell us the client's goal. Buying a house? Business loan? Car?
They tell us the deadline. Closing in 60 days changes how we work the file.
They tell us anything personal. Scared, embarrassed, burned by another company before. That context lets us build real rapport on the first call.

Then they follow up with their client: "Did you talk to the ASAP team yet? You are going to love them." That one text closes more deals than anything else.

The more you give us in the portal notes, the better your client's first call goes, and the better you look for sending them.

That is the whole system. Your portal: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 3, 'call', 8, null,
`Their company and occupation are on the affiliate card. Review BEFORE dialing, never ask what they do.
- Warm intro: "I saw you are over at {company}, wanted to put a voice to the name"
- Ask: "How often do you run into people with credit problems in your line of work?"
- Give the play for their world: lender = declined apps, realtor = pre-approval falls through, dealer = turned down at the desk, tax or insurance pro = clients who mention debt
- Ask where they feel stuck: not sure who fits? Awkward to bring it up? Never crossed their mind since signup?
- Offer to send the word for word talk track for their situation
- Zero pressure close: "the first one is the hardest, after that it is muscle memory"`);

add('new_never', 4, 'sms', 12, null,
`Hey {first_name}, it is {consultant_name} with ASAP. Just checking in since your portal went live. Any questions I can knock out for you? And if anyone in your world gets a no because of their credit, that is our lane. (Reply STOP to opt out)`);

add('new_never', 5, 'email', 18, 'Deleted in 14 days: the story behind our process',
`{first_name},

I want to show you what actually happens after you send someone our way, because it is the reason partners trust us with their name.

A client came to us with three collection accounts dragging their file down. Instead of sending basic disputes and hoping, we demanded full documentation from all three companies. Signed applications. Payment ledgers. Proof they were reporting legally.

Within 14 days, all three accounts were deleted. Not one of those companies even responded. They know who we are. We send over 100,000 dispute letters every single month, and the furnishers know we do not play games.

That is our credit accelerator program in one story. We do not guess. We demand proof, and what cannot be proven comes off.

Thirteen years. Over 67,000 clients. More than 2.3 million inaccurate records removed. More than 3,000 five star reviews.

When you put your name on a referral, that is the machine standing behind you.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 6, 'email', 30, 'How can we help you grow?',
`{first_name},

Honest check in, no agenda.

You have been set up with us for about a month now, and I would rather hear the truth than silence: what is getting in the way?

Some partners tell us they have not run into the right person yet. Some say bringing up credit feels awkward. Some just forgot the portal exists because life is busy. All normal, all fixable.

Whatever yours is, reply and tell me. If you need a talk track, I will write you one for your exact situation. If you have someone in mind but the conversation feels weird, intro us by text and we will take the whole thing from there. If it is something else, I want to know that too.

We are here to make you look good. That only works if I know where you are stuck.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 7, 'call', 42, null,
`Second call. Goal: find the real blocker and remove it.
- Reference anything learned from call 1 or their replies (check the touch timeline and notes)
- If they never sent anyone: "totally normal, most partners take a couple months to send their first. What would make it easier?"
- Offer the done for you assist: they make a text intro, we handle the entire conversation
- If they show any interest in growing this: mention top partners earn over $10,000 a month and offer to map what that path looks like for their business
- Log what you learn, it drives everything after`);

// ============ DORMANT (sold before, quiet 90+ days) ============
add('dormant', 1, 'email', 0, 'It has been a while, and that is on us',
`Hey {first_name},

I was going through our partner list and realized your last client with us was back in {last_referral_month}. You have sent us {sold_clients} over time, and I do not want the silence since then to be because we dropped the ball somewhere.

So, honest question, no pitch attached: did something change on your end, or did we do something that made you stop sending people our way? If it is the second one, I genuinely want to know.

A couple things have gotten better since {last_referral_month}, in case they matter to your clients. Progress Reports now go out on a set schedule, so the people you refer are never in the dark. And first round results are coming back faster, most clients see movement inside 45 days.

Either way, it is good to reconnect. Reply to this and it comes straight to me.

{consultant_name}
ASAP Credit & Financial Services`);

add('dormant', 2, 'sms', 4, null,
`Hey {first_name}, {consultant_name} from ASAP. Sent you an email but texts are easier. You sent us {sold_clients} great clients and then things went quiet on both sides. Anything we could be doing better for you or your clients? Straight answers welcome. (Reply STOP to opt out)`);

add('dormant', 3, 'call', 10, null,
`This is the important handoff conversation. Listen 80 percent.
- Open with appreciation, be specific: "{sold_clients} clients came through you"
- Ask the real question: "What would make it a no brainer to send the next one?"
- Listen for: bad client experience, payout confusion, they changed roles, a competitor
- If bad experience: get the client name, promise to run it down personally, then actually do it
- If payout: confirm their payout method on file, fix anything stale
- Give before leaving: offer the Handoff and Referral Guide or a co branded piece they can hand clients`);

add('dormant', 4, 'email', 20, 'The foreclosure nobody thought would come off',
`{first_name},

I want to share a story that shows what your referrals get when they work with us, because it is the kind of thing that reminded me of partners like you.

A client came in with a foreclosure from a major bank. Well documented, already disputed once by another company, already lost. Most programs would not touch it.

Round one, we demanded everything. The signed application, the promissory note, every statement, the default notices. To our surprise, the bank produced it all.

Round two, we went through every page and found the cracks. Inconsistent payment reporting. Ledger discrepancies. Even a misspelled legal name. We built the case and filed. They refused to delete.

Round three, we escalated to all three bureaus with the violations laid out. All three removed the foreclosure. Just under 120 days start to finish.

That is what thirteen years of doing this looks like. Your people are in good hands here, same as they always were.

Whenever the next one shows up: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

// ============ SLOWING (31 to 90 days since last client) ============
add('slowing', 1, 'email', 0, 'Checking in on your people',
`{first_name},

Your last client came through in {last_referral_month} and I wanted to check two boxes with you.

One, if you ever want a status update on anyone you have sent us, ask me directly. You put your name on them, and you should never have to wonder how it is going.

Two, a small thing that helps your future referrals convert. The clients who sign up fastest are the ones told one sentence up front: "the consultation is free and they only bill for actual results." When people hear that before they click, they show up ready instead of skeptical.

Nothing needed from you. The door is open, and so am I. How is business on your end?

{consultant_name}
ASAP Credit & Financial Services`);

add('slowing', 2, 'sms', 10, null,
`{first_name}, it is {consultant_name}. If anyone in your world got a no this month because of their credit, that is our lane. Send them through your portal and I will personally keep you posted on how they do. (Reply STOP to opt out)`);

add('slowing', 3, 'call', 21, null,
`Relationship maintenance plus one conversion idea.
- Check in on their business first, actually listen
- Ask if any referrals they sent did NOT sign up, offer to look into why and take another run at them
- Share their conversion picture if useful: "{sold_clients} of your {referred_deals} referrals became clients, want to talk about what happened with the rest?"
- Offer the Handoff and Referral Guide if they have never gotten it`);

// ============ PRODUCING (client in last 30 days) ============
add('producing', 1, 'email', 0, 'Your clients this month',
`{first_name},

Quick partner update, then I will get out of your way.

You have {sold_clients} {client_word} with us all time, and your most recent came through in {last_referral_month}. Thank you. Referrals are trust, and we do not take yours lightly.

Two standing offers, every month, always true:

One, want a status rundown on anyone you have sent? Reply with their name and you will have it same day.

Two, anything making referrals harder than it should be? Payout questions, a client experience that bugged you, a tool you wish existed? Tell me and I will fix what I can and be straight about what I cannot.

That is it. No ask. Keep sending people who need to get approval ready and we will keep making you look good for it.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ PRODUCING_FIRST (their very first client just sold - fires once, only while fresh) ============
add('producing_first', 1, 'email', 0, 'Congrats on your first client with us',
`{first_name},

Congrats on your first client with us! Genuinely. Most people who sign up as a partner never send anyone, so the fact that you already did puts you ahead of the pack.

Here is what happens now. We get your client moving, and most people see their first results inside 45 days. And you get paid: payouts go out on the 15th of the month after the client signs up, so yours is already in motion.

How are you feeling about everything so far? If anything about the process was confusing, or if there is anything we could have done better on that first one, reply and tell me. I read every one of these.

And when the next person in your world mentions credit trouble, same play as last time: {portal_link}

Proud to have you as a partner.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ COLD (signed up long ago, never sent) ============
add('cold', 1, 'email', 0, 'Just checking in',
`Hey {first_name},

Just checking in to see how you are doing. You set up a referral account with us a while back, and I wanted you to know it still works and we are still here.

No pitch. I am genuinely curious what happened on your end. Never ran into the right person? Forgot we existed? Were never quite sure what we actually do?

The short version, in case it helps: when someone gets declined for a loan, a mortgage, a car, or an apartment because of their credit, our credit accelerator program gets them approval ready. Free consultation, billing only for actual results, most people see first movement inside 45 days.

You get paid on every person you send who signs up. And if there is anything we could do to make referring easier for you, reply and tell me. I read every one.

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 2, 'email', 30, 'The moment to remember us',
`{first_name},

One idea, then I am gone.

You do not need to go find people with credit problems. You just need to remember one sentence for the moment someone mentions one. That moment sounds like: "I got turned down." "My score tanked." "We have to wait until my credit is better."

The sentence: "I know a team that fixes exactly that, want the link?"

Then you send your portal link, and we take the whole conversation from there.

That is the entire business of being our partner. One remembered sentence.

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 3, 'email', 60, 'What partners actually earn',
`{first_name},

Real talk about the money, since we have never discussed it.

Some of our top producing partners earn over $10,000 a month from referrals alone. That is the ceiling, not the average, but it is real and it is paid monthly.

Our most active partners are not marketers. They are lenders, realtors, dealers, and tax pros who simply route the people they were already turning away. The clients they could not help become clients they got paid on. And those same clients come back to them approval ready, which means deals that closed instead of dying.

That last part is the piece most people miss. You are not sending business away. You are recycling your own declines into future closings.

Whenever you are ready: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

// ============ ROTATION (monthly knowledge + check-in emails, all segments) ============
add('rotation', 1, 'email', 30, 'How our process actually works',
`{first_name},

One of the most common questions new clients ask us is "how does your process actually work?" It is a great question, because what we do is very different from what most people picture.

Here is a real example. A client came to us with a charge off on an auto loan. Instead of just disputing it, we demanded full documentation from the lender. The original loan agreement. The payment ledger. The signed application. Proof of legal compliance.

The lender replied, but their documentation was missing key pieces. They could not fully validate the account. Under federal reporting law, that failure triggers deletion rights. We filed on those grounds, and the account came off.

That is the difference between hoping and proving. Our credit accelerator program is built on accountability, and it is why the people you refer get real results.

If you ever want to walk through how this would play out for one of your clients, just reply. I love this stuff.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 2, 'email', 30, 'The CEO Method: late payments, gone fast',
`{first_name},

One of the biggest advantages your referrals get with us is speed, and I want to show you one of the tools behind it. We call it the CEO Method, and we use it on late payments.

C is Challenge. We open with a formal dispute demanding documentation that proves the late payment is valid.

E is Escalate. If the response is incomplete or inaccurate, we take it straight to the top, forwarding the issue to executive leadership and flagging the compliance problems.

O is Overturn. Those escalations trigger internal reviews, and companies would usually rather remove the item than carry the liability.

One client had a misreported late payment costing them their mortgage pre approval. Three weeks with this method and it was deleted. Their score jumped over 50 points and the loan was approved.

If you have a client sitting on a late payment right now, this is what is waiting for them on the other side of your portal link: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 3, 'email', 30, 'The three mistakes that keep people stuck',
`{first_name},

We see it constantly. People come to us frustrated and stuck, not because of what is on their credit report, but because of the advice they followed first. Here are the three big ones, so you can catch them in your world before they cost someone.

Mistake one: paying off negative debt. It sounds responsible, but paying a collection does not remove it. It can actually LOWER the score by resetting the activity date. We check the legal standing of the debt first.

Mistake two: debt consolidation. It closes accounts, drops the average account age, and most people pay more over time. We work to remove what cannot be legally verified instead.

Mistake three: disputing online. The online forms lock people into preset options and can waive important rights. And they rarely work.

If you ever hear someone about to make one of these moves, that is your moment. One sentence: "before you do that, let me connect you with a team I trust." You might save them thousands.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 4, 'email', 30, 'Two referrers, one client each',
`{first_name},

A quick story about the moment that matters most in this partnership.

Two clients got referred to us in the same week. The first came in as just a name and a number. No intro, no context. We reached out, but it felt cold to them, and they never responded.

The second came with a warm introduction. Their referrer told us she was trying to get a mortgage, scared about her score, and tired of being lied to by other companies. When we called, she said "I have been waiting to hear from you." She signed up that same day. Three weeks later her biggest negative account was deleted and she was in underwriting for her new home.

Same program. Same team. The only difference was the handoff.

When you submit someone through your portal, tell us their goal, their deadline, and anything personal we should know. Those notes are the difference between a cold call and a conversation they were waiting for.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 5, 'email', 30, 'Where are you stuck?',
`{first_name},

No lesson this month. Just a question.

What is the hardest part of referring for you right now?

For some partners it is spotting the moment. For some it is bringing credit up without it feeling awkward. For some it is that their industry does not surface these conversations often. And for some, honestly, it is that we have not given them the right tools yet.

Whatever yours is, reply and tell me in one sentence. I will send you something built for your exact situation: a talk track, a script for your team, a piece you can hand to clients. That is not a form response, it is me, and I answer every reply.

We are here to make you look good. Help me do my job.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 6, 'email', 30, 'Why we are trusted with your name',
`{first_name},

There are thousands of companies in this space. Very few get lasting results, because most send generic letters to the bureaus and hope.

We do not hope. We demand documentation directly from the creditors and data furnishers. Signed applications, payment ledgers, billing statements, original contracts. We find the errors and the violations, and we use federal law to force off what cannot be proven.

The track record behind that approach: thirteen years in business. More than 67,000 clients. Over 2.3 million inaccurate records removed. More than 3,000 five star reviews across Google, Facebook, and the BBB.

When you put your name on a referral, that is what stands behind it. Your people deserve more than letters and hope, and that is exactly why they are in the right hands with us.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 7, 'email', 30, 'What the top of the partner board looks like',
`{first_name},

We looked at what our highest earning partners do differently, and it is less impressive than you would hope. That is good news.

They mention us IN the decline conversation, not weeks later. The moment someone hears no, they hear "and here is what you can do about it" in the same breath.

They send the portal link in the same text. Not "I will connect you later." Later never comes.

And they check on their people afterward. "Did you talk to the ASAP team yet? You are going to love them." That one follow up text closes more clients than anything else we have measured.

That is the entire playbook. Our top partners earn over $10,000 a month, and there is no trick to it. They simply send the most people and hand them off warm.

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
