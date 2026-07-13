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
add('new_never', 1, 'email', 0, 'Now that your portal is set up (and the number that will surprise you)',
`Hey {first_name},

Now that your portal is set up, I wanted to check in and share something that may change how much this partnership is worth to you.

Every month I watch two kinds of partners send us referrals. Same number of leads. Same quality of people. Same program on our end. One partner converts 60 to 70 percent of the people they send. The other barely breaks 15.

That gap is not luck. It is not timing. It is not the leads. Over 13 years and 67,000 clients we have watched the pattern hold every single month, and it always comes down to the same ten seconds: the moment the client gets introduced to us.

In a couple of days I am going to send you the exact playbook the 70 percent partners use. It takes two minutes to run and it is the difference between referrals that vanish and referrals that sign up and thank you for it.

For now, one honest question so I can actually be useful to you: how often do you run into people with credit problems? Once a month? Every week? Every day? Reply with your answer and I will send you the exact talk track for the situation you see most. Not a form response. Me.

{consultant_name}
ASAP Credit & Financial Services

P.S. If you want to see what your name gets attached to before you ever attach it, reply with the words "show me" and I will send you a real case from our files: the actual dispute letters we sent and the deletion that came back.`);

add('new_never', 2, 'email', 4, 'The 15% partner vs the 70% partner (same leads, wildly different paychecks)',
`{first_name},

I promised you the handoff playbook. Before I give it to you, let me show you why it is worth five minutes of your day.

Think about the moment someone admits their credit is a problem. That person is embarrassed. They feel judged. They have probably been burned before, because this industry is full of companies that take monthly fees and mail form letters. So when that person hears "you could try these guys, here is a website," their guard goes UP. Another company. Another pitch. Another disappointment coming.

The 70 percent partners never let that happen. Here is their exact system. I call it the three part handoff, and it takes less than two minutes total.

PART ONE: THE EDIFY (10 seconds, in the moment)

The second credit comes up, you say one sentence. And I am going to give you two versions, because the worst thing you can do is say something that is not true for you yet. People can hear a borrowed recommendation.

If you have not sent us anyone yet, your honest script is this:

"I found a team that specializes in exactly this. They have helped over 67,000 people in 13 years, they only charge for actual results, and the consultation costs nothing. Worst case, you get a free expert look at your report. Want the link?"

Every word of that is verifiable, you can say it with a straight face, and it converts, because honesty converts.

Once you have sent someone and watched what we do, you unlock the stronger version:

"I know this team personally. I have seen what they did for someone I sent them. Can I introduce you?"

Personal proof beats borrowed proof every time. But it has to be real, which is why we want you to see our results firsthand as fast as possible.

PART TWO: THE CONTEXT (60 seconds, in your portal)

When you submit someone through your link, the notes box is where deals are won. Give us:

1. Their goal. A loan? A home? A car? What exactly are they trying to get approved for?
2. Their deadline. Someone hoping to close in 90 days gets a different game plan than someone starting early.
3. Their state of mind. Scared? Embarrassed? Burned by another company before? Tell us, because it changes our entire first call.
4. How you know them, so we open with warmth instead of a cold script.
5. Anything they already tried, so we never make them repeat their story.

Sixty seconds of notes means our first call sounds like a conversation with a friend of yours. Because that is exactly what it is.

PART THREE: THE FOLLOW UP TEXT (10 seconds, two days later)

This is the step almost everyone skips, and it is the single highest converting thing we have ever measured. Two days after you refer someone, text them:

"Hey, did you connect with the ASAP team yet? You are going to love them."

That text revives the busy ones, reassures the nervous ones, and reminds all of them that you are watching out for them.

Want proof this whole system works? Two clients came to us in the same week. The first arrived as a name and a phone number. No intro, no context. We called, it felt cold to them, and they never picked up again. The second came with the full handoff. Her referrer told us she was trying to buy a home, terrified about her score, and tired of being lied to. When we called, her first words were "I have been waiting to hear from you." She signed up the same day. Three weeks later her biggest negative account was deleted and she was in underwriting.

Same team. Same process. The handoff was the whole difference.

Your link, for the moment your next person needs it: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with the situation you run into most, a declined loan, a deal that died over a score, whatever it is, and I will write you the exact talk track for that exact moment. Personally.`);

add('new_never', 3, 'call', 8, null,
`Their company and occupation are on the affiliate card. Review BEFORE dialing, never ask what they do.
- Warm intro: "I saw you are over at {company}, wanted to put a voice to the name"
- Ask: "How often do you run into people with credit problems in your line of work?"
- Give the play for their world: lender = declined apps, realtor = pre-approval falls through, dealer = turned down at the desk, tax or insurance pro = clients who mention debt
- Ask where they feel stuck: not sure who fits? Awkward to bring it up?
- Offer the word for word talk track for their situation, and the "show me" case files if they have not seen results yet
- Zero pressure close: "the first one is the hardest, after that it is muscle memory"`);

add('new_never', 4, 'sms', 12, null,
`Hey {first_name}, it is {consultant_name} with ASAP. Just checking in since your portal went live. Any questions I can knock out for you? And if anyone in your world gets a no because of their credit, that is our lane. (Reply STOP to opt out)`);

add('new_never', 5, 'email', 18, 'Three collection accounts. Fourteen days. All deleted.',
`{first_name},

I want to walk you through a real case, start to finish, because it is the fastest way to show you what your name gets attached to when you refer someone to us.

A client came to us with three collection accounts wrecking their file. Three different companies. The client had already tried disputing on their own through the online forms. Nothing moved. That is the normal experience in this industry, and it is exactly why so many people believe nothing can be done.

Here is what we did differently, and why it worked in fourteen days.

STEP ONE: WE DEMANDED PROOF, NOT ATTENTION.

Most companies send the bureaus a generic letter that says "I dispute this." The bureaus run an automated check, the furnisher says "yep, it is his," and the dispute dies. We do not play that game. We went directly at all three companies and demanded the full documentation the law requires them to have: the original signed application, the complete payment ledger, the itemized breakdown of the debt, the records of their communication with the consumer, and proof their reporting met legal standards.

STEP TWO: THE SILENCE THAT SAYS EVERYTHING.

Not one of the three companies responded. Not one letter, not one document. Why? Because they know who we are. We send over 100,000 dispute letters every single month. The furnishers and the bureaus know exactly what we are going to ask for, and they know we do not go away. When a company cannot produce the documentation, they have two choices: fight a battle they will lose, or delete the account. All three chose deletion.

STEP THREE: FOURTEEN DAYS LATER, THE FILE WAS CLEAN.

Before the dispute round even closed, all three accounts were gone. Not "updated." Not "resolved." Deleted, as if they were never there. That is the difference between hoping and proving.

This is what our credit accelerator program actually is. Thirteen years of doing this. More than 67,000 clients. Over 2.3 million inaccurate records removed. More than 3,000 five star reviews across Google, Facebook, and the BBB. Not because we are lucky, but because we demand what the law entitles every consumer to demand, and most companies simply cannot produce it.

So when someone in your world gets told no because of their credit, this machine is what stands behind your referral: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Want to see the actual letters from a case like this? Reply "show me" and I will send you the real dispute letter and the deletion result, so you know firsthand what we do before you ever put your name on it.`);

add('new_never', 6, 'email', 30, 'How can we help you grow?',
`{first_name},

Honest check in, no agenda, and I will keep this one short on purpose.

You have been set up with us for about a month, and I would rather hear the truth than silence: what is getting in the way?

Some partners tell us they have not run into the right person yet. Some say bringing up credit feels awkward. Some just forgot the portal exists because life is busy. All normal, all fixable.

Whatever yours is, reply and tell me, and I will build you something for your exact situation. A word for word talk track for the moment you see most. A short piece you can hand to clients. The case files that show what we do. Or if you have someone in mind and the conversation feels weird, intro us by text and we will take the entire thing from there. You literally just make the intro.

We are here to make you look good. That only works if I know where you are stuck.

{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 7, 'call', 42, null,
`Second call. Goal: find the real blocker and remove it.
- Reference anything from call 1 or their replies (touch timeline on the card)
- If they never sent anyone: "totally normal, most partners take a couple months for the first one. What would make it easier?"
- Offer the done for you assist: they make a text intro, we run the entire conversation
- If growth interest: top partners earn over $10,000 a month, offer to map the path for their business
- Log what you learn, it drives everything after`);

// ============ REFERRED_PENDING (sent referrals, none sold yet - they are TRYING) ============
add('referred_pending', 1, 'email', 0, 'Thank you for who you sent (and the small fix that converts them)',
`{first_name},

First things first: thank you for the {referred_deals} {referral_word} you have already sent our way. Most partners never send anyone. You are already doing the thing that matters, and I do not take that lightly.

None of them has signed up yet, and I want to tell you something important: that is normal, and it is almost always fixable. When a referral does not convert, it is almost never about the person's need. Their credit problem did not disappear. It is about how warm the introduction was, and about what happened in the 48 hours after.

Here is what the data from thousands of referrals tells us. A person who gets a link with no context signs up about 15 percent of the time. A person who gets a warm one sentence introduction first, and then a single follow up text two days later, signs up 60 to 70 percent of the time. Same person. Same need. Same program.

So here are the two moves, and both take seconds.

MOVE ONE, for your next referral: before the link, one sentence. "This team has helped over 67,000 people in 13 years, they only charge for actual results, and the consultation costs nothing." That single sentence kills the scam fear and the cost fear before they ever click.

MOVE TWO, for the {referred_deals} already in motion: send each of them one text today. "Hey, did you connect with the ASAP team yet? You are going to love them." That text revives more stalled referrals than anything else we have ever measured. People get busy, people get nervous, and one nudge from someone they trust restarts everything.

You are closer than you think. If you want, reply and tell me a little about the people you sent, what they were trying to get approved for, and I will make sure our team gives them a call worth answering.

{consultant_name}
ASAP Credit & Financial Services

P.S. Want to see exactly what happens once they do sign up? Reply "show me" and I will send you a real case, the actual letters and the deletion that came back, so you know what you are vouching for.`);

add('referred_pending', 2, 'sms', 7, null,
`{first_name}, it is {consultant_name}. Quick one: if you nudge your referrals with a single text ("did you talk to the ASAP team yet?") we can usually get them moving. Want me to send you the exact wording? (Reply STOP to opt out)`);

add('referred_pending', 3, 'call', 14, null,
`They sent {referred_deals} referrals, zero converted. They are trying and probably a little discouraged. Lead with gratitude, never guilt.
- Ask what happened when they shared the link: in person? Text? How did the person react?
- Diagnose the handoff: cold link drop, or warm intro?
- Offer: next referral, they can three way text intro us and we take it live from there
- Offer to have our team re-attempt the stalled referrals TODAY with fresh energy
- Give the one liner for their industry (check the card for company and occupation)`);

add('referred_pending', 4, 'email', 24, 'The story of two referrers (this is about your people)',
`{first_name},

A quick story, because it is really the story of the {referred_deals} {referral_word} you have already sent.

Two clients got referred to us in the same week. The first came in as just a name and a number. No intro, no context. We reached out, but to them we were a cold call from a company they had never heard of. They never picked up again.

The second came with a warm introduction. Her referrer told us she was trying to get a mortgage, scared about her score, and tired of being lied to by other companies. When we called, her first words were "I have been waiting to hear from you." She signed up that same day. Three weeks later her biggest negative account was deleted and she was in underwriting for her new home.

Same team. Same program. The only difference was the handoff.

Your people have not signed up yet, and I suspect they got the first experience instead of the second. The fix costs you one text per person: "Hey, did you connect with the ASAP team yet? You are going to love them." Send it today. Then reply here and tell me you did, and I will make sure our team calls each of them within the day, armed with whatever context you can give me.

We can still win these. Together.

{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 5, 'email', 36, 'Where are you stuck?',
`{first_name},

No lesson this month. Just a question.

What is the hardest part of this for you right now? Getting people to click the link? Knowing what to say? The people you sent going quiet?

Reply in one sentence and I will send you something built for your exact situation. A talk track, a script for the follow up text, or I will simply have our team take another run at the people you already sent. That is not a form response. It is me, and I answer every reply.

You did the hard part already, you sent people. Let me help you get paid for it.

{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 6, 'call', 45, null,
`Conversion follow through call.
- Review which of their referrals are still open (check the card and Pipedrive)
- Report honestly what happened on our attempts, and what we will try next
- Re-teach the two move system: one sentence intro, one follow up text
- If any referral converted since last touch, CELEBRATE it, they are about to get the congrats email too`);

// ============ DORMANT (sold before, quiet 90+ days) ============
add('dormant', 1, 'email', 0, 'It has been a while, and that is on us',
`Hey {first_name},

I was going through our partner list and realized your last client with us was back in {last_referral_month}. You have sent us {sold_clients} {client_word} over time, and I do not want the silence since then to be because we dropped the ball somewhere.

So, honest question, no pitch attached: did something change on your end, or did we do something that made you stop sending people our way? If it is the second one, I genuinely want to know, because I will personally run it down.

A few things have gotten better since {last_referral_month}, in case they matter to your clients. Progress Reports now go out to every client on a set schedule, so the people you refer are never in the dark about where things stand. First round results are coming back faster, most clients see movement inside 45 days. And your affiliate portal shows you where every client you ever sent stands, any time you want to look.

Either way, it is good to reconnect. Reply to this and it comes straight to me, and I read every one.

{consultant_name}
ASAP Credit & Financial Services`);

add('dormant', 2, 'sms', 4, null,
`Hey {first_name}, {consultant_name} from ASAP. Sent you an email but texts are easier. You sent us {sold_clients} great clients and then things went quiet on both sides. Anything we could be doing better for you or your clients? Straight answers welcome. (Reply STOP to opt out)`);

add('dormant', 3, 'call', 10, null,
`THE important handoff conversation. Listen 80 percent.
- Open with appreciation, be specific: "{sold_clients} clients came through you"
- Ask the real question: "What would make it a no brainer to send the next one?"
- Listen for: bad client experience, payout confusion, they changed roles, a competitor
- If bad experience: get the client name, promise to run it down personally, then actually do it
- If payout: confirm their payout method on file, fix anything stale
- Give before leaving: the Handoff Guide, the case files, or a co branded piece for their clients`);

add('dormant', 4, 'email', 20, 'The foreclosure nobody thought would come off',
`{first_name},

I want to share a full case with you, start to finish, because it says everything about what your referrals get on this side of the fence. It is the story of a foreclosure from a major national bank, and it took us three rounds and just under 120 days.

ROUND ONE: WE ASKED FOR EVERYTHING.

Our client came in with a foreclosure blocking them from ever getting another mortgage. It was well documented. They had already disputed it through another company and lost. Most programs will not even touch a file like that.

We opened by demanding every document the law requires: the original signed loan application, the promissory note, the closing disclosures, the deed of trust, every monthly statement, the complete payment ledger, the default notices, and proof of compliance with state foreclosure law. To our honest surprise, the bank produced all of it. Usually they miss something, and a single missing document means automatic deletion under federal law. Not this time.

ROUND TWO: WE READ EVERY PAGE.

Most companies would have quit right there. We got to work instead. We went through that mountain of paperwork line by line, and that is where we found the cracks: inconsistent payment reporting across the monthly statements, multiple discrepancies in the ledger, a misspelled legal name, and a date mismatch between the default notice and the credit reporting timeline. We packaged every error and filed a dispute laying out exactly how each one violated reporting standards.

The bank refused to delete.

ROUND THREE: WE ESCALATED.

We took the full case to all three bureaus, Equifax, Experian, and TransUnion, citing the specific violations and the court precedents that back them. We demanded removal on the grounds of provable inaccuracy and the harm it was doing to our client. All three bureaus removed the foreclosure.

A hundred and twenty days from "impossible" to gone. That is what thirteen years and 2.3 million removed records look like in a single file.

Your people were always in good hands here, and they still are. Whenever the next one shows up: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. If a client experience ever made you hesitate to send someone, reply and tell me about it. I will personally pull the file and give you the straight story.`);

// ============ SLOWING (sold within 31 to 90 days, cooling off) ============
add('slowing', 1, 'email', 0, 'Checking in on your people',
`{first_name},

Your last client came through in {last_referral_month} and I wanted to check in, partner to partner.

First, remember that your affiliate portal shows where every client you have sent us stands, any time. And if you have a specific question about any of them, the kind a status page cannot answer, reply and I am happy to talk it through.

Second, a small thing that measurably helps your future referrals convert. The clients who sign up fastest are the ones told one sentence before they ever click: "they only charge for actual results, and the consultation costs nothing." When people hear that up front, they show up ready instead of skeptical. It takes ten seconds and it moves the numbers.

Nothing needed from you. The door is open, and so am I. How is business on your end?

{consultant_name}
ASAP Credit & Financial Services`);

add('slowing', 2, 'sms', 10, null,
`{first_name}, it is {consultant_name}. If anyone in your world got a no this month because of their credit, that is our lane. Send them through your link and I will personally keep an eye on how they do. (Reply STOP to opt out)`);

add('slowing', 3, 'call', 21, null,
`Relationship maintenance plus one conversion idea.
- Check in on their business first, actually listen
- Ask if any referrals they sent did NOT sign up, offer to take another run at them
- Share their conversion picture if useful: "{sold_clients} of your {referred_deals} referrals became clients, want to talk about what happened with the rest?"
- Offer the Handoff Guide if they have never gotten it`);

// ============ PRODUCING (client in last 30 days) ============
add('producing', 1, 'email', 0, 'Your partner update',
`{first_name},

Quick partner update, then I will get out of your way.

You have sent {referred_deals} {referral_word} our way, and {sold_clients} of them became paying {client_word}, including your most recent in {last_referral_month}. Thank you. Referrals are trust, and we do not take yours lightly.

Two things, always true. Your affiliate portal shows where every one of your clients stands, and if you have a specific question about any of them, the kind a status page cannot answer, reply and I am happy to talk it through. And if anything is making referrals harder than it should be, payout questions, a client experience that bugged you, a tool you wish existed, tell me and I will fix what I can and be straight about what I cannot.

That is it. No ask. Keep sending people who need to get approval ready, and we will keep making you look good for it.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ PRODUCING_FIRST (their very first client just sold) ============
add('producing_first', 1, 'email', 0, 'Congrats on your first client with us',
`{first_name},

Congrats on your first client with us! Genuinely. Most people who sign up as a partner never send anyone, so the fact that you already turned a referral into a client puts you ahead of the pack.

Here is what happens now. We get your client moving, and most people see their first results inside 45 days. Your client will get Progress Reports on a set schedule, so they are never in the dark, and you can watch their progress in your affiliate portal any time. And you get paid: payouts go out on the 15th of the month after the client signs up, so yours is already in motion.

How are you feeling about everything so far? If anything about the process was confusing, or if there is anything we could have done better on that first one, reply and tell me. I read every one of these.

And here is the thing about first clients: the second one is easier, because now when you say "I know this team, I have seen what they do," it is true. That sentence, plus your link, is the whole job: {portal_link}

Proud to have you as a partner.

{consultant_name}
ASAP Credit & Financial Services`);

// ============ COLD (signed up long ago, never sent) ============
add('cold', 1, 'email', 0, 'Just checking in',
`Hey {first_name},

Just checking in to see how you are doing. You set up a referral account with us a while back, and I wanted you to know it still works and we are still here.

No pitch. I am genuinely curious what happened on your end. Never ran into the right person? Forgot we existed? Were never quite sure what we actually do?

The short version, in case it helps: when someone gets declined for a loan, a mortgage, a car, or an apartment because of their credit, our credit accelerator program gets them approval ready. We have done it for over 67,000 people across 13 years. Free consultation, billing only for actual results, most people see first movement inside 45 days.

You get paid on every person you send who signs up. And if there is anything we could do to make referring easier for you, reply and tell me. I read every one.

{consultant_name}
ASAP Credit & Financial Services

P.S. If you were ever unsure whether this stuff actually works, reply "show me" and I will send you a real case from our files, the letters we sent and the deletions that came back. Seeing it changes everything.`);

add('cold', 2, 'email', 30, 'The moment to remember us',
`{first_name},

One idea, then I am gone.

You do not need to go find people with credit problems. You need to remember one sentence for the moment someone mentions one. And that moment happens more than you think. It sounds like: "I got turned down." "My score tanked." "We have to wait until my credit is better." "The bank said come back in a year."

Every one of those sentences is someone quietly telling you they have a problem worth thousands of dollars to solve, and no idea who can solve it.

The sentence you say back: "I know a team that fixes exactly that. They have helped over 67,000 people, they only charge for results, and the consult is free. Want the link?"

Then you send your link, and we take the entire conversation from there. You never explain how disputes work. You never follow up on paperwork. You make one introduction and you get paid when they sign up.

That is the entire business of being our partner. One remembered sentence: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 3, 'email', 60, 'What partners actually earn (real talk)',
`{first_name},

Real talk about the money, since we have never discussed it.

Some of our top producing partners earn over $10,000 a month from referrals alone. That is the ceiling, not the average, but it is real and it is paid monthly, and I want to show you how the math actually works, because it is not what most people picture.

Our most active partners are not marketers. They do not run ads or post content. They are lenders, realtors, dealers, tax pros, and insurance agents who made one change: instead of turning away the people they could not help, they route them to us.

Think about what a decline usually is. A dead end. The client leaves disappointed, and the deal, the loan, the sale, the policy, dies with them. Now look at what our partners turned that same moment into. The declined client goes to us, gets approval ready over 60 to 90 days, and comes BACK. The partner got paid on the referral, and then the original deal closes on the second try. They get paid twice on a moment that used to be worth zero.

That is the recycle loop, and it is why the top of our partner board is full of ordinary professionals, not influencers. They simply stopped wasting their declines.

Your link still works, whenever the next dead end walks in: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with what you do for work and I will send you the exact one liner our top partners in your industry use. Takes me two minutes, saves you the awkward part.`);

// ============ ROTATION (monthly value pieces - every 3rd rotation touch becomes a CALL) ============
add('rotation', 1, 'email', 30, 'How our process actually works (a real case, start to finish)',
`{first_name},

One of the most common questions we get, from clients and partners alike, is "how does your process actually work?" It is a fair question, because what we do is very different from what most people picture when they hear this industry's name. So let me answer it with a real case.

A client came to us with a charge off on an auto loan. It had been sitting on his report for two years, dragging his score down and killing a business loan he needed. He had already disputed it online, twice. Nothing moved.

Here is why online disputes fail, and what we did instead.

When you dispute online, you are locked into preset checkbox reasons, the bureau runs an automated verification, the lender's computer says "confirmed," and the dispute dies in days. Nobody ever actually looks at the account. Worse, those online forms can waive important legal rights you did not know you had.

We took a completely different road. We went directly at the lender and demanded the documentation federal law requires them to keep: the original signed loan agreement, the complete ledger of every payment, the signed application, and proof their reporting met legal compliance standards.

The lender replied. But their response was missing key documents. They could not fully validate their own account. And under the Fair Credit Reporting Act, an account that cannot be verified must be deleted. We filed on exactly those grounds, and the charge off came off his report.

His score jumped. The business loan closed. And the lender never sent so much as a complaint, because they know the law better than anyone. They just could not meet it.

That is our credit accelerator program in one story. We do not send hope. We send demands for proof, and what cannot be proven comes off. It is why 67,000 clients and 2.3 million removed records later, we bill for results instead of promises.

If you ever want to walk through how this would play out for someone in your world, reply. I genuinely love talking through these.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 2, 'email', 30, 'The CEO Method (late payments, gone in three weeks)',
`{first_name},

Today I want to show you one of the fastest tools in our arsenal, because if you ever refer someone whose only problem is late payments, this is what happens to their file.

We call it the CEO Method, and the name is literal.

C is CHALLENGE. We open with a formal dispute to the company demanding documentation that proves the late payment is valid: the payment records, the statements, the notice history. Not a complaint. A demand for proof.

E is ESCALATE. Here is where it gets interesting. If the response comes back incomplete or inaccurate, and it usually does, we do not send another letter into the same customer service pile. We take the file straight to the top: executive leadership, often including the office of the CEO, with the compliance problems laid out plainly. Executives read differently than call centers do. They see liability.

O is OVERTURN. Faced with documented reporting problems sitting on an executive's desk, companies almost always choose the cheap path: an internal review and a quick removal, rather than defending a compliance violation.

Real case: a client came to us with a misreported late payment that was costing him his mortgage pre approval. Not a collection, not a charge off, one late payment. Three weeks with the CEO Method and it was deleted. His score jumped over 50 points, and the mortgage was approved.

Most people, and honestly most companies in this industry, treat late payments as unfixable. "Just wait seven years." We do not wait. We go to the top.

So when someone tells you "I just have a couple of late payments, it is probably not worth it," now you know better. That person might be three weeks from approval: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. Reply "guide" and I will send you our CEO Method one pager, good for your own reference or to hand to a client.`);

add('rotation', 3, 'email', 30, 'The three mistakes that keep people stuck (catch them before they cost someone)',
`{first_name},

We see it every single week: people come to us frustrated and stuck, not because of what is on their credit report, but because of the advice they followed first. Usually well meaning advice. Usually from the internet, a bank teller, or a relative.

Here are the three big mistakes, why each one backfires, and what we do instead. Learn to spot these in conversation and you will catch referral moments everyone else misses.

MISTAKE ONE: PAYING OFF NEGATIVE DEBT.

It sounds responsible. It feels responsible. But paying a collection does not remove it from the report. The damage stays for years, and here is the cruel part: paying it can actually LOWER the score in the short term, because it updates the account's "last activity" date and makes old damage look fresh. We always review the legal standing of the debt first. If the collector cannot validate it with documentation, it does not get paid. It gets deleted.

The moment to listen for: "I am going to pay off these collections and then apply." Stop them. That order of operations can cost them the approval.

MISTAKE TWO: DEBT CONSOLIDATION.

The pitch sounds clean: one payment, one rate. The reality: it closes accounts, which crushes the average account age, which drops the score. Most people also end up paying more over the life of the plan. And the negative accounts it "consolidates" often stay right there on the report. We work to remove what cannot be legally verified instead of repackaging it.

The moment: "I am thinking about one of those consolidation programs." That person needs a second opinion before they sign, and the consultation is free.

MISTAKE THREE: DISPUTING ONLINE.

The bureaus made online disputing convenient on purpose. The forms lock people into preset options, trigger automated verifications that almost never dig into the account, and can waive legal rights in the fine print. Then the person concludes "I tried disputing, nothing works," and gives up forever. Our disputes are custom built, documentation driven, and sent where they create legal obligation, which is why they force real investigations.

The moment: "I already tried disputing, it did not work." That is not the end of their story. It is usually the beginning of ours.

One sentence saves people from all three: "Before you do that, let me connect you with a team I trust. The consult is free." Then: {portal_link}

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 4, 'email', 30, 'Two referrers, one client each (the ten seconds that decide everything)',
`{first_name},

A short story this month, because it carries the single most valuable lesson in this entire partnership.

Two clients got referred to us in the same week. On paper, identical situations. Both needed to get approval ready. Both were sent by partners we like. Both got the same team, the same process, the same program.

The first came in as a name and a phone number. No introduction, no context. When we called, we were a stranger from a company they had never heard of, calling about the most embarrassing subject in their life. They did not pick up the second time. Or the third. That referral died, and the partner never got paid.

The second came with a warm handoff. Her referrer told us she was trying to buy a home for her kids, that she was scared about her score, and that she had been lied to by another company before. When we called, we opened with all of that, gently. Her first words were "I have been waiting to hear from you." She signed up the same day. Three weeks later her biggest negative account was deleted, and she was in underwriting for the house.

Same team. Same program. The ten second introduction was the entire difference between a dead lead and a changed life.

The lesson, in three moves: say one warm sentence before the link. Put context in the portal notes, their goal, their deadline, their state of mind. And two days later, send the follow up text: "Did you connect with the ASAP team yet? You are going to love them."

That is it. That is the whole edge our top partners have over everyone else.

{consultant_name}
ASAP Credit & Financial Services

P.S. Next time you refer someone, try all three moves and then reply and tell me what happened. I keep score on these, and the pattern never misses.`);

add('rotation', 5, 'email', 30, 'Where are you stuck?',
`{first_name},

No lesson this month. Just a question, and I will keep it short on purpose.

What is the hardest part of referring for you right now?

For some partners it is spotting the moment. For some it is bringing credit up without it feeling awkward. For some, their industry just does not surface these conversations often. And for some, honestly, it is that we have not given them the right tools yet.

Whatever yours is, reply and tell me in one sentence. I will send you something built for your exact situation: a talk track, a script for your team, a piece you can hand to clients, or the case files that show exactly what we do. That is not a form response. It is me, and I answer every reply.

We are here to make you look good. Help me do my job.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 6, 'email', 30, 'Why I started this company (a note from our founder)',
`{first_name},

This month I want to share something a little different: the story behind the company you partner with, in our founder's own words. Worth two minutes of your day.

"I started ASAP in 2013 because I watched good people get treated like case numbers. People would come in with credit reports full of accounts that were flat out wrong, collections that were not theirs, balances reported incorrectly, payments marked late that were paid on time, and the entire industry's answer was the same: mail a form letter and hope.

I could not accept that the burden of proof sat on the consumer. The law says the opposite. The law says the companies reporting this information have to be able to PROVE it, with documentation, and if they cannot, it comes off. So we built our whole company on that one idea: stop hoping, start demanding proof.

Thirteen years later, that idea has served over 67,000 clients. We have removed more than 2.3 million inaccurate records. We send over 100,000 dispute letters a month, and the companies on the other side know our name. We bill for results, not promises, because I never wanted to be one more company collecting a monthly fee while a family waits.

But here is the part that matters to you. The clients who change the most are almost never the ones who found us through an ad. They are the ones somebody SENT. Somebody they trusted said 'I know a team that can fix this,' and that trust is half the battle before we ever pick up the phone. That is why we take our partners so seriously. You are not a marketing channel to us. You are the reason a scared person answers the phone.

So thank you for being one of the people who sends them."

Joe Mahlow, Founder and CEO

If any of that raises a question, or if you have a story about someone you sent us, reply. Both of us read them.

{consultant_name}
ASAP Credit & Financial Services`);

add('rotation_call', 1, 'call', 30, null,
`Monthly relationship call (every 3rd monthly touch is human, forever). No agenda, no pitch.
- Review the card first: their numbers, their industry, the Pipedrive follow-up notes, their replies
- Open warm and specific: reference something real (their last client, their industry season, a reply they sent)
- Ask how business is going, and actually listen for referral moments in their answer
- One idea for their world: lenders = declined apps, realtors = failed pre-approvals, dealers = desk turndowns, tax = refund season debt talk, insurance = rated-up clients
- If they have unconverted referrals: offer to have our team take a fresh run at them this week
- Close with: "anything you need from us? A talk track, case files, anything, I will send it today"
- Log the outcome, it feeds every message after this one`);

add('rotation', 7, 'email', 30, 'What the top of the partner board looks like',
`{first_name},

Once a year I like to pull back the curtain on our highest earning partners, because what they do differently is less impressive than you would hope. And that is very good news for you.

First, the number, so you know what is possible: our top partners earn over $10,000 a month from referrals. Not from ads. Not from content. From conversations they were already having.

Here is everything they do differently. All three things.

ONE: They mention us IN the decline conversation, not weeks later. The moment someone hears "no," they hear "and here is what you can do about it" in the same breath. Timing is everything, because a person's motivation to fix their credit peaks in the exact moment it costs them something. Wait a week and the motivation fades, the embarrassment wins, and they disappear.

TWO: They send the link in the same text as the recommendation. Not "I will connect you later." Later never comes. The sentence and the link travel together, every time: one thumb tap for the client while the pain is fresh.

THREE: They send the two day follow up text. "Did you connect with the ASAP team yet? You are going to love them." Ten seconds. It revives the busy, reassures the nervous, and it is the single highest converting behavior we have ever measured across thousands of referrals.

That is the entire playbook. No funnels, no scripts longer than a sentence, no marketing budget. The top of our board is ordinary professionals who simply send the most people and hand them off warm.

The math is simple from there. Every declined client you used to lose is a referral payout plus a future closed deal when they come back approval ready. The partners making five figures a month did not find more leads. They stopped wasting their declines.

Your link, same as always: {portal_link}

{consultant_name}
ASAP Credit & Financial Services

P.S. If you want to know what YOUR path to the top of the board looks like, reply "map it" and your consultant will call you this week and build it with you. That is a real offer.`);

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
