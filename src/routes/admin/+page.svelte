<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { playTapSound, playStepSound, playHoverSound } from '$lib/audio';

	let polls: any[] = $state([]);
	let selectedPoll: any = $state(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let successMsg = $state('');
	let eventSource: EventSource | null = null;
	let activeAdminTab = $state<'overview' | 'settings' | 'categories'>('overview');

	// Create/Edit Poll Wizard State
	let showWizardModal = $state(false);
	let isEditingPoll = $state(false);
	let editingPollId = $state('');
	let wizardTitle = $state('');
	let wizardDesc = $state('');
	let wizardWinnerAllocation = $state('no-duplicate-winners');
	let wizardShowLiveTotals = $state(false);
	let categories: any[] = $state([
		{
			id: '',
			title: 'Best Costume',
			description: 'Rank your top 3 costumes',
			votingStrategy: 'ranked-choice',
			options: [
				{ id: '', title: 'Cyberpunk Neo', description: 'Glowing neon coat', candidateKey: 'alex' },
				{ id: '', title: 'Disco Banana', description: 'Sequined jumpsuit', candidateKey: 'jordan' },
				{ id: '', title: 'Retro Mario', description: 'Classic overalls with giant mustache', candidateKey: 'taylor' }
			]
		}
	]);

	onMount(async () => {
		await loadPolls();
	});

	onDestroy(() => {
		if (eventSource) eventSource.close();
	});

	async function loadPolls() {
		loading = true;
		try {
			const res = await fetch('/api/polls');
			const data = await res.json();
			polls = data.polls || [];
			if (polls.length > 0 && (!selectedPoll || !selectedPoll.poll)) {
				await loadPollDetails(polls[0].id);
			}
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}

	async function loadPollDetails(id: string) {
		try {
			const res = await fetch(`/api/polls/${id}`);
			const data = await res.json();
			selectedPoll = data;
			subscribeAdminSse(id);
		} catch (e: any) {
			errorMsg = 'Failed to load poll details';
		}
	}

	function subscribeAdminSse(pollId: string) {
		if (eventSource) eventSource.close();
		eventSource = new EventSource(`/api/polls/${pollId}/stream`);

		eventSource.addEventListener('vote_submitted', () => loadPollDetails(pollId));
		eventSource.addEventListener('poll_updated', () => loadPollDetails(pollId));
		eventSource.addEventListener('status_changed', () => loadPollDetails(pollId));
		eventSource.addEventListener('presentation_step_changed', () => loadPollDetails(pollId));
	}

	function exportPollBackup() {
		if (!selectedPoll) return;
		window.open(`/api/polls/${selectedPoll.poll.id}/export`, '_blank');
	}

	async function seedPollVotes(pollId: string) {
		playTapSound();
		try {
			const res = await fetch(`/api/polls/${pollId}/seed`, { method: 'POST' });
			const data = await res.json();
			if (res.ok) {
				successMsg = `Seeded ${data.voterCount} test voters & ballots for this poll!`;
				await loadPollDetails(pollId);
				setTimeout(() => (successMsg = ''), 4000);
			} else {
				errorMsg = data.error || 'Failed to seed poll votes.';
			}
		} catch (e: any) {
			errorMsg = e.message || 'Seed operation failed.';
		}
	}

	async function importPollBackup(e: Event) {
		const fileInput = e.target as HTMLInputElement;
		const file = fileInput.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const json = JSON.parse(text);

			const res = await fetch('/api/polls/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(json)
			});
			const data = await res.json();

			if (res.ok) {
				successMsg = `Successfully imported poll "${data.poll.title}".`;
				await loadPolls();
				await loadPollDetails(data.poll.id);
				setTimeout(() => (successMsg = ''), 3000);
			} else {
				errorMsg = data.error || 'Failed to import poll.';
			}
		} catch (err: any) {
			errorMsg = err.message || 'Invalid backup file format.';
		} finally {
			fileInput.value = '';
		}
	}

	function openCreateWizard() {
		playTapSound();
		isEditingPoll = false;
		editingPollId = '';
		wizardTitle = '';
		wizardDesc = '';
		wizardWinnerAllocation = 'no-duplicate-winners';
		wizardShowLiveTotals = false;
		categories = [
			{
				id: '',
				title: 'Best Costume',
				description: 'Rank your top 3 costumes',
				votingStrategy: 'ranked-choice',
				options: [
					{ id: '', title: 'Candidate 1', description: '', candidateKey: 'candidate1' },
					{ id: '', title: 'Candidate 2', description: '', candidateKey: 'candidate2' }
				]
			}
		];
		showWizardModal = true;
	}

	function openEditWizard() {
		if (!selectedPoll) return;
		playTapSound();
		isEditingPoll = true;
		editingPollId = selectedPoll.poll.id;
		wizardTitle = selectedPoll.poll.title;
		wizardDesc = selectedPoll.poll.description || '';
		wizardWinnerAllocation = selectedPoll.poll.winnerAllocationStrategy;
		wizardShowLiveTotals = selectedPoll.poll.showLiveTotals;

		categories = selectedPoll.categories.map((c: any) => ({
			id: c.category.id,
			title: c.category.title,
			description: c.category.description || '',
			votingStrategy: c.category.votingStrategy,
			options: c.options.map((o: any) => ({
				id: o.id,
				title: o.title,
				description: o.description || '',
				candidateKey: o.candidateKey || ''
			}))
		}));
		showWizardModal = true;
	}

	function applyPreset(presetType: 'costume' | 'gamenight' | 'awards') {
		playTapSound();
		if (presetType === 'costume') {
			wizardTitle = 'Halloween Costume Contest';
			wizardDesc = 'Scan to vote for the best party costumes!';
			categories = [
				{
					id: '',
					title: 'Best Overall Costume',
					description: 'Rank your top 3 favorite costumes',
					votingStrategy: 'ranked-choice',
					options: [
						{ id: '', title: 'Cyberpunk Ninja', description: '', candidateKey: 'alex' },
						{ id: '', title: 'Disco Banana', description: '', candidateKey: 'sam' },
						{ id: '', title: 'Retro Gamer', description: '', candidateKey: 'jordan' }
					]
				},
				{
					id: '',
					title: 'Most Creative / Funniest',
					description: 'Single vote for funniest entry',
					votingStrategy: 'plurality',
					options: [
						{ id: '', title: 'Inflatable T-Rex', description: '', candidateKey: 'taylor' },
						{ id: '', title: 'Cereal Killer', description: '', candidateKey: 'chris' }
					]
				}
			];
		} else if (presetType === 'gamenight') {
			wizardTitle = 'Party Game Night Awards';
			wizardDesc = 'Rate and vote on the night\'s gaming MVPs and best moments!';
			categories = [
				{
					id: '',
					title: 'Game Night MVP',
					description: 'Rank your top players',
					votingStrategy: 'ranked-choice',
					options: [
						{ id: '', title: 'Alex', description: 'Board game champion', candidateKey: 'alex' },
						{ id: '', title: 'Sam', description: 'Trivia master', candidateKey: 'sam' }
					]
				},
				{
					id: '',
					title: 'Favorite Game Played',
					description: 'Rate each game 1-5 stars',
					votingStrategy: 'score',
					options: [
						{ id: '', title: 'Catan', description: '', candidateKey: 'catan' },
						{ id: '', title: 'Codenames', description: '', candidateKey: 'codenames' }
					]
				}
			];
		}
	}

	async function saveWizardPoll() {
		if (!wizardTitle.trim()) {
			errorMsg = 'Please enter a poll title.';
			return;
		}

		try {
			playStepSound();
			if (isEditingPoll) {
				const res = await fetch(`/api/polls/${editingPollId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: wizardTitle.trim(),
						description: wizardDesc.trim(),
						winnerAllocationStrategy: wizardWinnerAllocation,
						showLiveTotals: wizardShowLiveTotals,
						categories
					})
				});
				const data = await res.json();
				if (res.ok) {
					showWizardModal = false;
					await loadPolls();
					await loadPollDetails(editingPollId);
					successMsg = 'Poll updated successfully.';
					setTimeout(() => (successMsg = ''), 3000);
				} else {
					errorMsg = data.error || 'Failed to update poll';
				}
			} else {
				const res = await fetch('/api/polls', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: wizardTitle.trim(),
						description: wizardDesc.trim(),
						winnerAllocationStrategy: wizardWinnerAllocation,
						showLiveTotals: wizardShowLiveTotals,
						categories
					})
				});
				const data = await res.json();
				if (res.ok) {
					showWizardModal = false;
					await loadPolls();
					await loadPollDetails(data.poll.id);
					successMsg = 'Poll created successfully.';
					setTimeout(() => (successMsg = ''), 3000);
				} else {
					errorMsg = data.error || 'Failed to create poll';
				}
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function toggleStatus(newStatus: string) {
		if (!selectedPoll) return;
		playStepSound();
		try {
			const res = await fetch(`/api/polls/${selectedPoll.poll.id}/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: newStatus })
			});
			if (res.ok) {
				successMsg = `Status changed to ${newStatus.toUpperCase()}`;
				if (newStatus === 'closed') {
					await setRevealState(0, 0);
				}
				await loadPollDetails(selectedPoll.poll.id);
				await loadPolls();
				setTimeout(() => (successMsg = ''), 3000);
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function toggleTvTotals(show: boolean) {
		if (!selectedPoll) return;
		playTapSound();
		try {
			const res = await fetch(`/api/polls/${selectedPoll.poll.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ showLiveTotals: show })
			});
			if (res.ok) {
				successMsg = show ? 'TV now showing live totals' : 'TV in Secret Ballot mode';
				await loadPollDetails(selectedPoll.poll.id);
				setTimeout(() => (successMsg = ''), 3000);
			}
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	let masterAutoInterval: any = null;

	$effect(() => {
		if (selectedPoll?.poll?.isAutoPlaying && selectedPoll?.poll?.status === 'closed') {
			if (!masterAutoInterval) {
				masterAutoInterval = setInterval(() => {
					navigateSubStep(1);
				}, 3200);
			}
		} else {
			if (masterAutoInterval) {
				clearInterval(masterAutoInterval);
				masterAutoInterval = null;
			}
		}
	});

	async function setRevealState(step: number, subStep: number = 0) {
		if (!selectedPoll) return;
		playStepSound();
		try {
			await fetch(`/api/polls/${selectedPoll.poll.id}/reveal`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ step, subStep })
			});
			await loadPollDetails(selectedPoll.poll.id);
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function toggleMasterAutoPlay(isAutoPlaying: boolean) {
		if (!selectedPoll) return;
		playTapSound();
		try {
			await fetch(`/api/polls/${selectedPoll.poll.id}/reveal`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAutoPlaying })
			});
			await loadPollDetails(selectedPoll.poll.id);
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	async function navigateSubStep(dir: number) {
		if (!selectedPoll) return;

		const categories = selectedPoll.categories || [];
		let currentStep = selectedPoll.poll.currentRevealStep || 0;
		let currentSubStep = selectedPoll.poll.currentRevealSubStep ?? 0;

		if (currentStep === 0 && dir > 0) {
			currentStep = 1;
			currentSubStep = 0;
		} else if (dir > 0) {
			const activeCat = categories[currentStep - 1];
			const rcvRounds = activeCat?.result?.rcvRounds || [];

			if (currentSubStep === 0) {
				if (activeCat?.category?.votingStrategy === 'ranked-choice' && rcvRounds.length > 0) {
					currentSubStep = 1;
				} else {
					currentSubStep = 99;
				}
			} else if (currentSubStep < rcvRounds.length) {
				currentSubStep++;
			} else if (currentSubStep !== 99) {
				currentSubStep = 99;
			} else {
				if (currentStep < categories.length) {
					currentStep++;
					currentSubStep = 0;
				} else {
					// Reached end of all categories! Pause auto-play
					await toggleMasterAutoPlay(false);
					return;
				}
			}
		} else if (dir < 0) {
			const activeCat = categories[currentStep - 1];
			const rcvRounds = activeCat?.result?.rcvRounds || [];

			if (currentSubStep === 99) {
				if (activeCat?.category?.votingStrategy === 'ranked-choice' && rcvRounds.length > 0) {
					currentSubStep = rcvRounds.length;
				} else {
					currentSubStep = 0;
				}
			} else if (currentSubStep > 1) {
				currentSubStep--;
			} else if (currentSubStep === 1) {
				currentSubStep = 0;
			} else if (currentStep > 1) {
				currentStep--;
				currentSubStep = 99;
			} else {
				currentStep = 0;
				currentSubStep = 0;
			}
		}

		await setRevealState(currentStep, currentSubStep);
	}

	async function deletePoll(id: string) {
		if (!confirm('Are you sure you want to delete this party poll?')) return;
		playStepSound();
		try {
			await fetch(`/api/polls/${id}`, { method: 'DELETE' });
			selectedPoll = null;
			await loadPolls();
		} catch (e: any) {
			errorMsg = e.message;
		}
	}

	function addCategory() {
		playTapSound();
		categories.push({
			id: '',
			title: `Category ${categories.length + 1}`,
			description: '',
			votingStrategy: 'ranked-choice',
			options: [{ id: '', title: 'Candidate 1', description: '', candidateKey: '' }]
		});
	}

	function removeCategory(index: number) {
		playTapSound();
		categories.splice(index, 1);
	}

	function addOption(catIndex: number) {
		playTapSound();
		categories[catIndex].options.push({
			id: '',
			title: `Candidate ${categories[catIndex].options.length + 1}`,
			description: '',
			candidateKey: ''
		});
	}

	function removeOption(catIndex: number, optIndex: number) {
		playTapSound();
		categories[catIndex].options.splice(optIndex, 1);
	}

	function copyCandidatesFromCategory(targetCatIndex: number, sourceCatIndex: number) {
		if (sourceCatIndex < 0 || sourceCatIndex >= categories.length) return;
		playTapSound();
		const sourceOpts = categories[sourceCatIndex].options;
		categories[targetCatIndex].options = sourceOpts.map((o: any) => ({
			id: '',
			title: o.title,
			description: o.description || '',
			candidateKey: o.candidateKey || ''
		}));
		successMsg = `Copied ${sourceOpts.length} candidates from "${categories[sourceCatIndex].title}".`;
		setTimeout(() => (successMsg = ''), 3000);
	}

	function copyCandidatesToAllCategories(sourceCatIndex: number) {
		playTapSound();
		const sourceOpts = categories[sourceCatIndex].options;
		for (let i = 0; i < categories.length; i++) {
			if (i !== sourceCatIndex) {
				categories[i].options = sourceOpts.map((o: any) => ({
					id: '',
					title: o.title,
					description: o.description || '',
					candidateKey: o.candidateKey || ''
				}));
			}
		}
		successMsg = `Copied candidates to all ${categories.length - 1} other categories.`;
		setTimeout(() => (successMsg = ''), 3000);
	}
</script>

<svelte:head>
	<title>Host Admin | PartyVote</title>
</svelte:head>

<div class="admin-space-layout">
	<!-- Top Header -->
	<header class="empire-panel admin-header">
		<div>
			<a href="/" class="back-link" onclick={playTapSound} onmouseenter={playHoverSound}>← HOME PORTAL</a>
			<span class="page-title-subtle">[ HOST MISSION CONTROL ]</span>
		</div>
		<div class="header-actions">
			{#if selectedPoll}
				<button
					class="btn btn-sm btn-ghost"
					onclick={exportPollBackup}
					onmouseenter={playHoverSound}
					title="Download JSON Backup"
				>
					EXPORT BACKUP
				</button>
			{/if}
			<label
				for="import-backup-file"
				class="btn btn-sm btn-ghost"
				style="margin: 0; cursor: pointer;"
				onmouseenter={playHoverSound}
			>
				IMPORT BACKUP
			</label>
			<input
				type="file"
				id="import-backup-file"
				accept=".json"
				style="display: none;"
				onchange={importPollBackup}
			/>
			<button
				class="btn btn-primary"
				onclick={openCreateWizard}
				onmouseenter={playHoverSound}
			>
				+ NEW POLL
			</button>
		</div>
	</header>

	{#if errorMsg}
		<div class="alert alert-error">{errorMsg}</div>
	{/if}
	{#if successMsg}
		<div class="alert alert-success">{successMsg}</div>
	{/if}

	<!-- Active Poll Selector -->
	<section class="empire-panel compact-panel">
		<div class="panel-tag">[ SELECT ACTIVE PARTY POLL ]</div>
		<select
			class="input-field"
			onchange={(e) => loadPollDetails((e.target as HTMLSelectElement).value)}
		>
			{#each polls as p}
				<option value={p.id} selected={selectedPoll?.poll?.id === p.id}>
					{p.title} ({p.status.toUpperCase()})
				</option>
			{/each}
		</select>
	</section>

	{#if selectedPoll}
		{@const poll = selectedPoll.poll}
		{@const isClosed = poll.status === 'closed'}
		{@const totalCats = selectedPoll.categories.length}
		{@const currentStep = poll.currentRevealStep || 0}

		<!-- Admin Section Tabs -->
		<div class="admin-tabs-nav">
			<button
				class="admin-tab-btn {activeAdminTab === 'overview' ? 'admin-tab-active' : ''}"
				onmouseenter={playHoverSound}
				onclick={() => { playTapSound(); activeAdminTab = 'overview'; }}
			>
				OVERVIEW & CEREMONY
			</button>
			<button
				class="admin-tab-btn {activeAdminTab === 'settings' ? 'admin-tab-active' : ''}"
				onmouseenter={playHoverSound}
				onclick={() => { playTapSound(); activeAdminTab = 'settings'; }}
			>
				TV DISPLAY SETTINGS
			</button>
			<button
				class="admin-tab-btn {activeAdminTab === 'categories' ? 'admin-tab-active' : ''}"
				onmouseenter={playHoverSound}
				onclick={() => { playTapSound(); activeAdminTab = 'categories'; }}
			>
				CATEGORIES ({totalCats})
			</button>
		</div>

		<!-- TAB 1: OVERVIEW & CONTROLS -->
		{#if activeAdminTab === 'overview'}
			<section class="empire-panel">
				<div class="status-top">
					<div>
						<div class="panel-tag">[ POLL STATUS & CONTROL ]</div>
						<h2>{poll.title}</h2>
						{#if poll.description}<p class="sub-text">{poll.description}</p>{/if}
					</div>
					<div class="status-right">
						<span class="badge {isClosed ? 'badge-closed' : 'badge-active'}">
							{poll.status.toUpperCase()}
						</span>
						<button class="btn btn-cyan btn-sm" onclick={openEditWizard} onmouseenter={playHoverSound}>
							EDIT POLL
						</button>
					</div>
				</div>

				<div class="space-v"></div>

				<div class="action-row">
					{#if !isClosed}
						<button
							class="btn btn-danger flex-1"
							onclick={() => toggleStatus('closed')}
							onmouseenter={playHoverSound}
						>
							🔒 CLOSE VOTING & START CEREMONY
						</button>
					{:else}
						<button
							class="btn btn-primary flex-1"
							onclick={() => toggleStatus('active')}
							onmouseenter={playHoverSound}
						>
							🔓 RE-OPEN VOTING
						</button>
					{/if}
					<a
						href="/tv/{poll.id}"
						class="btn flex-1"
						target="_blank"
						onclick={playTapSound}
						onmouseenter={playHoverSound}
					>
						📺 OPEN TV DISPLAY
					</a>
					<a
						href="/vote/{poll.id}"
						class="btn flex-1"
						target="_blank"
						onclick={playTapSound}
						onmouseenter={playHoverSound}
					>
						📱 TEST GUEST BALLOT
					</a>
					<button
						class="btn btn-gold flex-1"
						onclick={() => seedPollVotes(poll.id)}
						onmouseenter={playHoverSound}
					>
						🌱 RE-SEED DEMO VOTES
					</button>
				</div>
			</section>

			{#if isClosed}
				{@const currentStep = poll.currentRevealStep || 0}
				{@const currentSubStep = poll.currentRevealSubStep ?? 0}
				{@const isAutoPlaying = poll.isAutoPlaying ?? false}
				{@const activeCategory = currentStep > 0 ? selectedPoll.categories[currentStep - 1] : null}
				{@const rcvRoundsCount = activeCategory?.result?.rcvRounds?.length || 1}

				<section class="empire-panel ceremony-control-card empire-panel-cyan">
					<div class="panel-tag">[ HOST MASTER TV BROADCAST CONTROL CONSOLE ]</div>
					<div class="space-v"></div>

					<!-- Live TV Teleprompter Monitor -->
					<div class="teleprompter-monitor">
						<div class="teleprompter-header">
							<span class="pulse-dot"></span>
							<span class="lbl">TV BROADCAST STATUS MONITOR:</span>
						</div>
						<div class="teleprompter-content">
							{#if currentStep === 0}
								<span class="status-text standby">STANDBY MODE (Waiting to start category reveals)</span>
							{:else if activeCategory}
								<div class="status-live-info">
									<span class="cat-label">CATEGORY #{currentStep}: <strong>{activeCategory.category.title}</strong></span>
									<span class="substep-label">
										{#if currentSubStep === 0}
											📺 STAGE 1: Category Title Intro
										{:else if currentSubStep === 99}
											🏆 STAGE 3: Official Winner Trophy Card ({activeCategory.result.winnerOptionTitle})
										{:else}
											⚡ STAGE 2: RCV Round {currentSubStep} of {rcvRoundsCount}
										{/if}
									</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="space-v"></div>

					<!-- Master Auto-Play Toggle & Step Stepper -->
					<div class="master-control-row">
						<button
							class="btn {isAutoPlaying ? 'btn-danger' : 'btn-gold'} btn-lg flex-2"
							onclick={() => toggleMasterAutoPlay(!isAutoPlaying)}
							onmouseenter={playHoverSound}
						>
							{isAutoPlaying ? '⏸ PAUSE CEREMONY AUTO-PLAY' : '▶ START AUTOMATED CEREMONY'}
						</button>

						<button
							class="btn flex-1"
							disabled={currentStep <= 1 && currentSubStep <= 0}
							onclick={() => navigateSubStep(-1)}
							onmouseenter={playHoverSound}
						>
							⏮ PREV SUB-STEP
						</button>

						<button
							class="btn btn-cyan flex-1"
							onclick={() => navigateSubStep(1)}
							onmouseenter={playHoverSound}
						>
							NEXT SUB-STEP ⏩
						</button>

						<button
							class="btn btn-gold flex-1"
							disabled={currentStep <= 0}
							onclick={() => setRevealState(currentStep, 99)}
							onmouseenter={playHoverSound}
						>
							🏆 WINNER FINALE
						</button>
					</div>

					<div class="space-v"></div>

					<!-- Direct Stage Stepper per Category -->
					<div class="category-stepper-grid">
						<div class="panel-tag">[ DIRECT CATEGORY & SUB-STEP STAGE JUMP ]</div>
						<div class="space-v-sm"></div>

						<div class="cat-stepper-list">
							<button
								class="step-pill {currentStep === 0 ? 'step-pill-active' : ''}"
								onclick={() => setRevealState(0, 0)}
								onmouseenter={playHoverSound}
							>
								STANDBY
							</button>

							{#each selectedPoll.categories as catItem, cIdx}
								{@const stepNum = cIdx + 1}
								{@const isThisCatActive = currentStep === stepNum}
								{@const catRounds = catItem.result?.rcvRounds || []}

								<div class="cat-control-group {isThisCatActive ? 'cat-group-active' : ''}">
									<button
										class="step-pill {isThisCatActive ? 'step-pill-active' : ''}"
										onclick={() => setRevealState(stepNum, 0)}
										onmouseenter={playHoverSound}
									>
										#{stepNum} {catItem.category.title}
									</button>

									{#if isThisCatActive}
										<div class="substep-pills">
											<button
												class="btn btn-xs {currentSubStep === 0 ? 'btn-cyan' : 'btn-ghost'}"
												onclick={() => setRevealState(stepNum, 0)}
												onmouseenter={playHoverSound}
											>
												Title
											</button>

											{#if catItem.category.votingStrategy === 'ranked-choice' && catRounds.length > 0}
												{#each catRounds as r, rIdx}
													{@const rSubStep = rIdx + 1}
													<button
														class="btn btn-xs {currentSubStep === rSubStep ? 'btn-cyan' : 'btn-ghost'}"
														onclick={() => setRevealState(stepNum, rSubStep)}
														onmouseenter={playHoverSound}
													>
														R{r.roundNumber} {r.eliminatedOptionId ? '⚡' : ''}
													</button>
												{/each}
											{/if}

											<button
												class="btn btn-xs {currentSubStep === 99 ? 'btn-gold' : 'btn-ghost'}"
												onclick={() => setRevealState(stepNum, 99)}
												onmouseenter={playHoverSound}
											>
												🏆 Winner
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</section>
			{/if}

			<section class="empire-panel">
				<div class="panel-tag">[ SUBMITTED GUEST BALLOTS // COUNT: {selectedPoll.voters.length} ]</div>
				<div class="space-v"></div>

				{#if selectedPoll.voters.length === 0}
					<p class="muted-text">No votes received yet.</p>
				{:else}
					<div class="voter-grid">
						{#each selectedPoll.voters as voter}
							<div class="voter-chip">
								{voter.nickname}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- TAB 2: TV DISPLAY SETTINGS -->
		{#if activeAdminTab === 'settings'}
			<section class="empire-panel">
				<div class="panel-tag">[ TV DISPLAY MODE ]</div>
				<p class="sub-text">Control running tallies display during active voting:</p>
				<div class="space-v"></div>

				<div class="setting-row">
					<button
						class="btn {selectedPoll.poll.showLiveTotals ? '' : 'btn-primary'}"
						onmouseenter={playHoverSound}
						onclick={() => toggleTvTotals(false)}
					>
						SECRET BALLOT (RECOMMENDED)
					</button>
					<button
						class="btn {selectedPoll.poll.showLiveTotals ? 'btn-primary' : ''}"
						onmouseenter={playHoverSound}
						onclick={() => toggleTvTotals(true)}
					>
						SHOW LIVE RUNNING TOTALS
					</button>
				</div>
			</section>
		{/if}

		<!-- TAB 3: CATEGORIES OVERVIEW -->
		{#if activeAdminTab === 'categories'}
			<section class="empire-panel">
				<div class="cat-tab-header">
					<div class="panel-tag">[ CONFIGURATIONS ]</div>
					<button class="btn btn-cyan btn-sm" onclick={openEditWizard} onmouseenter={playHoverSound}>
						EDIT CATEGORIES & CANDIDATES
					</button>
				</div>
				<div class="space-v"></div>

				<div class="cat-list">
					{#each selectedPoll.categories as catItem}
						{@const res = catItem.result}
						{@const optMap = new Map((catItem.options || []).map((o: any) => [o.id, o.title]))}
						<div class="cat-item-box">
							<div class="cat-item-top">
								<strong>{catItem.category.title}</strong>
								<span class="badge badge-strategy">{catItem.category.votingStrategy}</span>
							</div>
							<div class="cand-pills-row">
								{#each catItem.options as opt}
									<span class="cand-pill">{opt.title}</span>
								{/each}
							</div>

							{#if res && res.rcvRounds && res.rcvRounds.length > 0}
								<div class="admin-rcv-preview">
									<div class="admin-rcv-tag">⚡ HOST RCV ROLL-OFF BREAKDOWN:</div>
									<div class="admin-rcv-rounds-list">
										{#each res.rcvRounds as r}
											{@const adminTransfers = (r.transfers ? Object.entries(r.transfers) : []) as [string, number][]}
											<div class="admin-rcv-round-row">
												<span class="r-num">Round {r.roundNumber}:</span>
												{#if r.eliminatedOptionId}
													<span class="r-elim">Eliminated {r.eliminatedOptionTitle || optMap.get(r.eliminatedOptionId)}</span>
													{#if adminTransfers.length > 0}
														<span class="r-transfers">
															{#each adminTransfers as [targetId, count]}
																<span class="r-chip">
																	{targetId === 'exhausted' ? `💨 ${count} exhausted` : `+${count} ➜ ${optMap.get(targetId) || targetId}`}
																</span>
															{/each}
														</span>
													{/if}
												{:else}
													<span class="r-win">🏆 Winner: {res.winnerOptionTitle}</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<div class="danger-row">
			<button class="btn btn-danger" onclick={() => deletePoll(poll.id)} onmouseenter={playHoverSound}>
				DELETE POLL
			</button>
		</div>
	{/if}
</div>

<!-- Modal Wizard (Create & Edit Poll) -->
{#if showWizardModal}
	<div class="modal-backdrop">
		<div class="modal-content empire-panel">
			<div class="modal-header">
				<h2>{isEditingPoll ? 'EDIT POLL & CATEGORIES' : 'CREATE NEW POLL'}</h2>
				<button class="close-btn" onclick={() => (showWizardModal = false)}>✕</button>
			</div>

			<div class="modal-body">
				{#if !isEditingPoll}
					<div class="presets-row">
						<span class="panel-tag">QUICK PRESETS:</span>
						<button
							class="btn btn-sm btn-ghost"
							onmouseenter={playHoverSound}
							onclick={() => applyPreset('costume')}
						>
							🎃 COSTUME PARTY
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onmouseenter={playHoverSound}
							onclick={() => applyPreset('gamenight')}
						>
							🎲 GAME NIGHT
						</button>
					</div>
					<div class="space-v"></div>
				{/if}

				<div class="form-group">
					<label for="pTitle" class="panel-tag">Poll Title *</label>
					<input
						id="pTitle"
						type="text"
						class="input-field"
						placeholder="e.g. Annual Party Awards 2026"
						bind:value={wizardTitle}
					/>
				</div>

				<div class="form-group">
					<label for="pDesc" class="panel-tag">Description</label>
					<input
						id="pDesc"
						type="text"
						class="input-field"
						placeholder="e.g. Scan QR code to submit votes"
						bind:value={wizardDesc}
					/>
				</div>

				<div class="form-group">
					<label for="pAlloc" class="panel-tag">Cross-Category Winner Allocation Rule</label>
					<select id="pAlloc" class="input-field" bind:value={wizardWinnerAllocation}>
						<option value="no-duplicate-winners">No Duplicate Winners (1 Win Max Per Person)</option>
						<option value="standard">Standard (Independent Categories)</option>
					</select>
				</div>

				<div class="space-v"></div>

				<div class="cat-builder-head">
					<div class="panel-tag">CATEGORIES & CANDIDATES ({categories.length})</div>
					<button class="btn btn-sm" onclick={addCategory} onmouseenter={playHoverSound}>+ ADD CATEGORY</button>
				</div>

				{#each categories as cat, cIdx}
					<div class="builder-cat-box">
						<div class="builder-row">
							<input
								type="text"
								class="input-field flex-2"
								placeholder="Category Title (e.g. Best Costume)"
								bind:value={cat.title}
							/>
							{#if categories.length > 1}
								<button
									class="btn btn-danger btn-sm"
									onmouseenter={playHoverSound}
									onclick={() => removeCategory(cIdx)}
								>
									✕
								</button>
							{/if}
						</div>

						<div class="form-group">
							<label for="cat-strat-{cIdx}" class="panel-tag">Voting Strategy</label>
							<select id="cat-strat-{cIdx}" class="input-field" bind:value={cat.votingStrategy}>
								<option value="ranked-choice">Ranked Choice (Instant Runoff)</option>
								<option value="borda-count">Borda Count (Rank Points)</option>
								<option value="plurality">Plurality (Single Favorite)</option>
								<option value="approval">Approval (Select Multiple)</option>
								<option value="score">Star Rating (1-5 Stars)</option>
							</select>
						</div>

						{#if categories.length > 1}
							<div class="copy-toolbar">
								<span class="panel-tag">CANDIDATE UTILITIES:</span>
								<div class="copy-toolbar-actions">
									<select
										class="input-field input-field-sm"
										onchange={(e) => {
											const val = (e.target as HTMLSelectElement).value;
											if (val !== '') {
												copyCandidatesFromCategory(cIdx, parseInt(val));
												(e.target as HTMLSelectElement).value = '';
											}
										}}
									>
										<option value="">Copy Candidates From...</option>
										{#each categories as sourceCat, sIdx}
											{#if sIdx !== cIdx}
												<option value={sIdx}>"{sourceCat.title}" ({sourceCat.options.length} candidates)</option>
											{/if}
										{/each}
									</select>

									<button
										class="btn btn-sm"
										onmouseenter={playHoverSound}
										onclick={() => copyCandidatesToAllCategories(cIdx)}
									>
										COPY TO ALL CATEGORIES
									</button>
								</div>
							</div>
						{/if}

						<div class="builder-opts-box">
							<div class="opt-head">
								<label for="cat-{cIdx}-options" class="panel-tag">Candidates ({cat.options.length})</label>
								<button class="btn btn-sm" onclick={() => addOption(cIdx)} onmouseenter={playHoverSound}>+ CANDIDATE</button>
							</div>

							{#each cat.options as opt, oIdx}
								<div class="builder-row" id="cat-{cIdx}-options">
									<input
										type="text"
										class="input-field flex-2"
										placeholder="Candidate Name"
										bind:value={opt.title}
									/>
									<input
										type="text"
										class="input-field flex-1"
										placeholder="Key (e.g. alex)"
										bind:value={opt.candidateKey}
									/>
									{#if cat.options.length > 1}
										<button
											class="btn btn-danger btn-sm"
											onmouseenter={playHoverSound}
											onclick={() => removeOption(cIdx, oIdx)}
										>
											✕
										</button>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="modal-footer">
				<button class="btn" onclick={() => (showWizardModal = false)} onmouseenter={playHoverSound}>CANCEL</button>
				<button class="btn btn-primary" onclick={saveWizardPoll} onmouseenter={playHoverSound}>
					{isEditingPoll ? 'SAVE CHANGES' : 'CREATE POLL'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-space-layout {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 36px;
	}

	.header-actions {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.compact-panel {
		padding: 20px 28px;
	}

	.back-link {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--accent-cyan);
		margin-right: 12px;
	}

	.admin-tabs-nav {
		display: flex;
		gap: 12px;
	}

	.admin-tab-btn {
		padding: 12px 20px;
		background: var(--bg-panel);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.admin-tab-active {
		background: var(--bg-panel-elevated);
		border: var(--border-stark);
		color: var(--text-primary);
		box-shadow: 4px 4px 0px #ffffff;
	}

	.status-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.sub-text {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin-top: 4px;
	}

	.status-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.action-row {
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
	}

	.stepper-track {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 8px;
	}

	.step-pill {
		padding: 8px 14px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.step-pill-active {
		border-color: var(--accent-cyan);
		color: var(--accent-cyan);
		box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
	}

	.voter-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.voter-chip {
		padding: 8px 16px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.setting-row {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.cat-tab-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.cat-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.cat-item-box {
		padding: 16px 20px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
	}

	.cat-item-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.cand-pills-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.cand-pill {
		padding: 4px 10px;
		background: var(--bg-space);
		border: 1px solid var(--border-subtle);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.danger-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-primary);
		font-size: 1.5rem;
		cursor: pointer;
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.presets-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.cat-builder-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 12px;
	}

	.builder-cat-box {
		padding: 20px;
		background: var(--bg-panel-elevated);
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.builder-row {
		display: flex;
		gap: 10px;
	}

	.flex-2 { flex: 2; }
	.flex-1 { flex: 1; }

	.copy-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--bg-input);
		padding: 10px 14px;
		border: 1px solid var(--border-subtle);
		flex-wrap: wrap;
		gap: 10px;
	}

	.copy-toolbar-actions {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.input-field-sm {
		padding: 6px 12px;
		font-size: 0.8rem;
		width: auto;
	}

	.builder-opts-box {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 6px;
	}

	.opt-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 14px;
		margin-top: 24px;
	}

	.muted-text { color: var(--text-dim); }

	/* ADMIN RCV ROLL OFF PREVIEW */
	.admin-rcv-preview {
		margin-top: 12px;
		background: var(--bg-space);
		border: 1px solid var(--accent-cyan);
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.admin-rcv-tag {
		color: var(--accent-cyan);
		font-weight: 800;
	}

	.admin-rcv-rounds-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.admin-rcv-round-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}

	.r-num {
		color: var(--text-secondary);
		font-weight: 700;
	}

	.r-elim {
		color: #ff6666;
		font-weight: 700;
	}

	.r-win {
		color: var(--accent-gold);
		font-weight: 800;
	}

	.r-transfers {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.r-chip {
		background: rgba(0, 240, 255, 0.1);
		border: 1px solid rgba(0, 240, 255, 0.25);
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 0.8rem;
		color: var(--text-primary);
	}

	/* TELEPROMPTER MONITOR & MASTER CONTROLS */
	.teleprompter-monitor {
		background: var(--bg-space);
		border: 2px solid var(--accent-cyan);
		box-shadow: inset 0 0 15px rgba(0, 240, 255, 0.15);
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.teleprompter-header {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--accent-cyan);
	}

	.status-live-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-family: var(--font-mono);
	}

	.cat-label {
		font-size: 1.1rem;
		color: #ffffff;
	}

	.substep-label {
		font-size: 1rem;
		color: var(--accent-gold);
		font-weight: 700;
	}

	.status-text.standby {
		font-family: var(--font-mono);
		color: var(--text-secondary);
		font-weight: 700;
	}

	.master-control-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.flex-2 { flex: 2; }
	.flex-1 { flex: 1; }

	.category-stepper-grid {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cat-stepper-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.cat-control-group {
		background: var(--bg-space);
		border: 1px solid var(--border-subtle);
		padding: 10px 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.cat-group-active {
		border-color: var(--accent-cyan);
		background: rgba(0, 240, 255, 0.05);
	}

	.substep-pills {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
</style>
