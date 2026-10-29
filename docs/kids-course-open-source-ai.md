# Build Anything with Open-Source AI
### A story course for young builders: Mia builds real apps with Claude and free open-source models

This is the final narration, word for word, as voiced in the videos (7 chapters, story version). The narrator is Gemini TTS **Aoede** (Australian English), directed per the voice guide for young kids. Each chapter has a video and a subtitle file in `deliverables/kids-course/renders3/`, and ends on the Astryks logo.

> **Voice cloning note (Chapter 6):** voice cloning has been misused to trick and fool people. It's for entertainment and learning only. Only use someone's voice if they've said yes.

## Chapter 1: Free Superpowers

This video is going to be so much fun.

Because in this video, we'll explore the power of open source software, and we'll build some amazing things. Now, it sounds complicated, but it's really not.

All you need to know is that there are some amazing companies out there, who invested so much time and money to build really complicated tools. And they decided to give them away, for free!

They cost nothing, and you can make them your own, and customise them.

For example, Meta made one where you draw a character on paper, take a photo, and it brings your drawing to life. It walks, jumps, and dances!

Another one, also from Meta, takes any song, and pulls out just the guitar, so you can learn the chords to your favourite songs.

Microsoft made one that turns a single photo into a 3D object you can spin around, and drop into your own video game. And Alibaba made one that creates super realistic videos, from just a few words.

There are models for investing strategies, for games, for music, and thousands more.

You can ask Claude about any topic you're interested in, and see if there's an open source model for it!

The first thing you need to know, is that you need absolutely no technical ability.

To show you how it all works, let me tell you a story. This is Mia. She's ten, and she loves music. And in two weeks, it's her grandma's birthday!

Mia has a big plan. She wants to play Grandma's favourite song on the piano, as a surprise. There's just one problem. Mia doesn't know how to play it!

So Mia asks her mum for help. Together, they get a Claude subscription, and download the Claude app.

At the top of the app, there's a button that says Code. That's the magic button! It opens Claude Code, where Claude can actually build things on your computer.

Mia doesn't know any coding. But that's okay! She just talks to Claude like a friend, in plain, simple English. And Claude does all the technical stuff.

By the way, you can also use other AI helpers, like ChatGPT's Codex, or whatever you like. This is in no way sponsored. In this course, we'll use Claude.

Now, Claude is something called a closed model. Think of Mia's favourite pizza shop. The pizza is delicious, but the recipe is a secret. You can eat it, but you can't see how it's made.

Claude, ChatGPT and Gemini are all closed models, a bit like that pizza shop.

An open source model is more like Grandma's recipe book. Anyone can borrow it, cook at home, and even change the recipe however they like. For free!

Today, we'll build two projects, with Mia.

Project one. Imagine you have a favourite song, and you want to learn it on the piano. Just like Mia does, for Grandma's birthday.

We'll build a tool where you can upload a song, use an open source model, and it'll pull apart all the instruments, and teach you how to play just the piano part!

Project two. Mia's little brother, Sam, loves bedtime stories. And the best storyteller he knows is Mia's friend, Leo, who does the funniest voices.

So we'll use Chatterbox. It's a free open source model, licensed under MIT.

If we record just fifteen seconds of someone's voice, the model can copy it. So Leo can read Sam a story, any night he likes, as long as Leo says yes!

You can build anything you can imagine. So grab a snack, get comfy, because Mia's adventure starts right now. Let's get started!

## Chapter 2: Learn Any Song

Chapter two. Learn any song.

Mia already uses an app called Hayden Keys. It's a free app that teaches you piano, a bit like a game. Coloured blocks fall down the screen, and when one lands on a key, you play that key.

But when Mia searches for Grandma's favourite song, it isn't there! The app only has the songs its team has added.

And guess what? The Hayden Keys team had been wishing for the same thing. What if anyone could upload their favourite song, and an AI model would work out the notes, and teach them how to play it?

So, let's help build it! But how do you build something like that? Here's the secret. You don't need to know how. You just need to know who to ask.

Step one. Mia opens Claude, and asks what open source models already exist. Claude goes off, does some research, and comes back with two perfect ones.

The first one is called Demucs, made by Meta. Imagine Grandma makes a smoothie, with strawberries, banana and mango, all blended together. You can't pick the banana back out, can you?

Well, Demucs can do that with music! You give it a song, and it un-blends it, into the singing, the drums, the bass, and everything else.

The second one is called Basic Pitch, made by Spotify. It's like a friend with super ears. It listens to music, and writes down every note. Which key, when it starts, and how long it lasts.

Put them together, and you've got the whole feature. Demucs pulls out the piano. Basic Pitch writes down its notes. And the app turns them into falling blocks, to play along with.

And both of them are free, and open source. Years of clever work, given away to anyone. Even to Mia!

Mia's got her two magic models. Now comes the best part. We're going to build it, for real! Ready? Let's go!

## Chapter 3: Let's Build It!

Chapter three. Let's build it!

Step two. Ask Claude to build it. But first, Mia needs two things.

Thing number one is GitHub. GitHub is like Google Drive, but for code. It keeps all your project's files safe online, with save points, just like in a video game. So if something breaks, you can always go back.

Thing number two is a terminal. That's a window where you type instructions to the computer. To find it on a Mac, press Command and Space, and type Terminal. Or you can download a free app called VS Code.

Here's the cool part. Claude Code has its own terminal built in! So most of the time, Claude types and runs all the commands for you.

But sometimes, Claude asks you to run a command yourself. Like when you need to log in to an account, or type a password. Claude never sees your passwords, so that part is always your job.

So Mia copies the command, pastes it into Terminal, and presses enter. Her mum helps with the password. Then she tells Claude: done! And Claude carries on.

Step three. Every website needs an address, called a domain. Hayden Keys lives at Hayden Keys dot com. Mia picks her own: my piano songs dot com! Her mum helps her buy it, from a website like GoDaddy. It costs about fifteen to thirty dollars a year.

And that's really it! Claude will guide Mia through everything else. She just follows along.

Sometimes, Claude asks Mia to set up an account. Like Vercel, which puts her website on the internet. Or Stripe, if she ever wants to take payments. Whenever Claude needs her, it stops, and tells her exactly what to click.

Mia talks to Claude like a friend. She tells it her idea, asks questions, and says so when something looks wrong.

Okay. Let's try it out!

Mia types: Hi Claude! I want to add a feature to my piano app. People upload a song they love, and it teaches them to play it. Use the open source models Demucs and Basic Pitch. Explain each step simply, and ask me before spending any money.

Claude makes a plan, and gets to work. It installs the tools, writes the code, and saves everything to GitHub.

Then it tests everything, all by itself. Uh oh! Something breaks. The song file is too big. But Claude reads the error, and fixes it.

It also suggests renting a GPU. That's a super fast computer chip, perfect for splitting songs. And it tells Mia how much it costs, before spending anything.

When it's ready, Claude puts the website online, and connects Mia's domain.

And now, the moment of truth. Here's the real thing, on Hayden Keys! Mia uploads Grandma's favourite song.

Demucs splits it into layers. The singing, the drums, the bass, and the piano. Then Basic Pitch writes down every piano note. And there it is! Grandma's song, as falling blocks, ready to play.

Mia practises every day after school. Slowly at first. Then a bit faster. Then faster again.

Then, on Grandma's birthday, Mia sits down at the piano, and plays her favourite song. Grandma can't believe it. She gives Mia the biggest hug!

How cool is this? You can upload any song, and it pulls out the piano notes for you. You can learn your favourite songs, from the artists you love. Learn from the best!

And then, try making your own music too! Just remember to only upload songs you're allowed to use. Other people's music belongs to them.

By the way, our friends at Hayden Keys built a free website, where anyone can learn to play the piano. And they used Claude to build it too!

You can build anything you want, and upload it to the App Store, or Google's Play Store. For the App Store, you may need a free app from Apple called Xcode. Don't worry, Claude will guide you through everything. Just take it one step at a time.

Share it with your friends. Let yourself wander around, and explore!

Mia did it! And guess what? So can you. But how does Demucs actually know where the drums are? Grab your detective hat, because next, we're going behind the scenes!

## Chapter 4: How Does It Really Work?

Chapter four. How does it really work?

After the party, Mia has a big question. How does Demucs actually know which sound is the drums? Let's find out how it was made.

Demucs was built by a small team of researchers at Meta's AI lab in Paris, led by a scientist called Alexandre Défossez.

So, what did they do when they came into work? A lot of it looked like this. Coffee. Reading research papers, to see what other teams had discovered. Writing code. And listening. Lots of listening, to check if the drums really came out clean.

First, sound has to become numbers. A sound is a wiggly wave. The computer measures how high the wave is, forty-four thousand times every second. So one song becomes millions of numbers!

Next, they needed songs to learn from. And not just any songs. To learn how to un-mix a song, you need the answers. Songs where every instrument was recorded on its own. Those separate tracks are called stems.

There's a famous free collection called MUSDB eighteen, with a hundred and fifty songs like this. The Meta team added about eight hundred more of their own.

But how do the songs get into the model? They sit on big storage drives. A little bit of code, called a data loader, picks a song, cuts out a few seconds, and turns it into numbers. Then it feeds them to the model, a few at a time, in batches.

And here's a clever trick. The loader mixes the drums from one song with the bass from another, and makes them a little faster, or higher. So the model hears endless brand new songs!

They didn't start from scratch. They built on PyTorch, a free toolbox, also made at Meta, that does all the heavy maths on GPUs. Almost every AI model you've heard of is built on PyTorch, or something like it.

Then they wrote the code that sets up the model. It's a list of layers, like an assembly line. Some layers listen to the wave. Some look at a picture of the sound. And a part called a transformer, in the middle, lets them share clues.

Then comes the training. It's a bit like Mia learning the piano. Mix the stems into a song. Ask the model to un-mix it. Check its drums against the real drums. Then nudge all its numbers a tiny bit, to be a little less wrong next time.

Does a person check all those millions of guesses? Nope! The computer already knows the answers, because it made the mix itself. So it marks its own homework, millions of times.

All this runs on GPUs, powerful chips in huge buildings called data centres, humming away for days. Then the team listens to the results, tweaks the recipe, and trains again.

When it finally sounded great, they wrote a paper explaining how it works, put the code on GitHub, and shared it with the world, for free. And that's how Mia got to use it!

One model down, one to go! Next, we'll shrink down tiny, and sneak inside Basic Pitch. Ready? Let's dive in!

## Chapter 5: Inside Basic Pitch

Chapter five. Inside Basic Pitch.

Now, what about Basic Pitch, the model that writes down the notes? It was built at Spotify, by a team called the Audio Intelligence Lab. They're music scientists, who love music as much as maths.

One of the lead researchers is Rachel Bittner.

Their goal was different from Demucs. Not un-mixing a song. Listening to it, and writing down the notes. And they wanted it small and fast enough to run on your phone. Like packing for a big trip, in a tiny backpack!

To learn notes, a model needs music where the right notes are already known. So they gathered some very special recordings.

Piano, played on special pianos that record every key press. Guitar, recorded with a tiny microphone on each string. Singing, with every note written down. And songs played by a computer, so the answers are perfect.

Then they hit a tricky problem. When you play one note on the piano, you don't just hear that note. You also hear quieter notes above it, called overtones. Like a little ghost choir, singing along!

So they used a clever trick, called harmonic stacking. They make copies of the sound picture, shifted, so a note and all its overtones line up in one neat column. Then the model can spot the real note, easily.

They built it with TensorFlow, a free toolbox from Google that's a lot like PyTorch. And the model is tiny. Fewer than twenty thousand numbers! The voice model we'll meet next has about five hundred million.

And it learns the same way, just like Demucs. Guess the notes. Check them against the real notes. Nudge. Over and over, on GPUs, until it's really good.

Spotify shared it for free, with an open licence. That's why apps like Hayden Keys can run it right inside your web browser, without paying a cent per song.

And that's the big secret. Every model you'll ever use is made of people, data, and lots of guess, check, nudge.

That night, Mia had even more questions. So she went down the rabbit hole with Claude! She asked: show me the code that sets up Demucs, and explain each line like I'm ten. And: how does harmonic stacking work? Draw me a picture.

There's no wrong question. Claude never gets tired of explaining. And you can do it too!

Now, remember little Sam, and his bedtime stories? It's time for project two. Warm up those voices, because we're about to make some magic. Let's go!

## Chapter 6: Recreate Any Voice

Chapter six. Recreate any voice.

Remember Mia's little brother, Sam? Every night, he begs for a bedtime story. And his favourite storyteller is Mia's best friend, Leo, who does the funniest voices.

But Leo can't come over every night. So Mia has an idea. What if a computer could read the stories, in Leo's voice?

There are open source models that can do this. They're called text to voice. You type some words, and a voice reads them out loud.

And the newest ones can copy almost any voice, from just fifteen seconds of someone talking!

Now, a quick but really important note. Voice cloning has been misused, to trick and fool people. So this is for entertainment and learning only. Please only ever use someone's voice if they've said yes.

That's exactly what Mia does. She asks Leo first. And Leo says: yes, let's do it!

This is simply to show you the magic of technology, and of open source models that are getting better and better, so quickly.

Step one. Mia asks Claude which open source models exist for text to voice. It finds a few.

Step two. Pick one. Mia chooses Chatterbox, made by a company called Resemble AI. It's free, it sounds great, and it can copy a voice from a short clip.

Step three. She asks Claude to build it, just like before. She needs GitHub, and a domain for her website. Chatterbox needs a GPU to run fast, so Claude suggests renting one, for less than a dollar an hour.

Step four. Mia has the model! Now for the fun part. Leo reads out loud for fifteen seconds, and Mia records him. She uploads the recording, types a story, and presses play.

Hmm. It sounds a bit like Leo. But it's flat, like a robot reading. Where are all his funny voices?

Step five. Mia asks Claude how to make it sound more like Leo. And Claude says: when the copy sounds a bit flat, you can add something called a LoRA.

Remember Grandma's recipe book? Imagine Chatterbox is a giant book about how people talk, with hundreds of millions of numbers. Instead of rewriting the whole book, you add a few tiny sticky notes. That's a LoRA! It stands for Low-Rank Adaptation. A big, fancy name, for tiny sticky notes!

The big book stays frozen. You only train the sticky notes. So Leo records a bit more, maybe half an hour. And Mia trains the sticky notes on a rented GPU, for a few minutes.

And now, it really sounds like Leo! His laugh, his rhythm, and all his funny voices. Sam giggles all the way through his bedtime story.

Isn't that amazing? You're basically training your own AI model!

Give yourself a big high five! You just built two amazing projects. And in the very last chapter, we'll discover what else is out there. Trust me, it's a lot! Let's find out!

## Chapter 7: Find Any Model

Chapter seven. Find any model.

The next day at school, Mia shows her friends what she built. And now, they all want to build something too!

Here's the biggest secret of this whole course. Whatever you're into, there's probably an open source model for it. Just ask Claude. And they're free to play with.

Alice loves making films. She asks Claude, and finds open models that turn words into videos, like Wan, from Alibaba.

Leo wants his own AI helper. Open chat models, like Llama and Qwen, can run on your own computer. And you can build your own agent, that does jobs for you.

Jack loves the share market. Every morning, he checks how his favourite companies are doing, the way other kids check the weather. Sunny? Rainy? Up? Down?

And there's one mystery Jack just can't stop thinking about. A company called Renaissance, started by a maths genius named Jim Simons. Before that, Jim was a maths professor, and even a secret code breaker!

Renaissance has a fund called Medallion, and it's a legend. Over twenty years or longer, the share market has historically grown about ten to eleven percent a year. But Medallion grew about sixty-six percent a year, before fees! And even after fees, over thirty percent a year, for more than thirty years!

So how did they do it? Imagine looking at millions of prices, and spotting tiny patterns no human could ever see. That's what their maths and computers did. But the exact recipe? Still a secret, locked away in a vault.

So Jack asks Claude: are there any open source models that could give me a starting point? And Claude says yes! There's one called Kronos. It studied over twelve billion price snapshots, from forty-five stock exchanges around the world, to learn the language of the market!

Jack can use Kronos to get started. Then he can try combining it with other open source tools, like FinRL, and Microsoft's Qlib. He brainstorms with Claude, and plays around with them!

Jack won't beat Medallion tomorrow. But he can test his ideas on old prices, like a time machine, and learn how the pros think. And only ever with a small amount of money, that his mum has agreed to, for research, and that they're both prepared to lose.

And Zara loves games. There are open models that make 3D objects, music, and character voices. And free game engines, like Godot, to put it all together.

Find anything that interests you. Ask Claude what exists, ask it to build something, and experiment. Break things. Fix them. Try again.

But wait. Why would companies give these away for free? Imagine two lemonade stands. One sells lemonade for five dollars. The other gives it away for free. Which one gets all the customers? The free one! And it can still make money, by selling other things, like cookies and cupcakes.

Companies are the same. Sometimes, they give their models away for free, so lots of people use theirs, instead of the big closed ones, and they make money from their other products. And sometimes, it's just because people love building things, and want to share them. That's how a lot of science works.

So take these models, and make them your own. Play around, wander around, and let your mind explore!

It may sound complicated. And that's because it is! But a lot of amazing researchers have worked really hard on it, and now it's there for you to use. Ask Claude to explain everything, and have fun with it.

And maybe someday, just like the researchers who made Demucs and Basic Pitch, you'll create an amazing open source model, and share it with the world.

So, what will you build first? Open Claude, tell it your idea, like you're talking to a friend, and let's get started!
