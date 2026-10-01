import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isFacebookVideoUrl, loadLobbyVideos } from '../lib/lobbyVideos'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { confirmModal, notifyError, notifySuccess, notifyWarning } from '../lib/notify'
import { digitsOnly } from '../lib/typedNumber'
import './LobbyVideosCard.css'

// Registrar Head: the Facebook videos the lobby queue display plays every
// 2 minutes (e.g. posts from the Holy Cross of Davao College page).
function LobbyVideosCard() {
    const [videos, setVideos] = useState([])
    const [loaded, setLoaded] = useState(false)
    const [unavailable, setUnavailable] = useState(false)
    const [url, setUrl] = useState('')
    const [title, setTitle] = useState('')
    const [seconds, setSeconds] = useState('60')
    const [saving, setSaving] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [syncNote, setSyncNote] = useState('')

    const refresh = () =>
        loadLobbyVideos({ includeInactive: true })
            .then(({ videos: list, unavailable: missing }) => {
                setVideos(list)
                setUnavailable(missing)
            })
            .catch((err) => console.error('LOBBY VIDEOS ERROR:', err))
            .finally(() => setLoaded(true))

    useEffect(() => {
        let cancelled = false
        loadLobbyVideos({ includeInactive: true })
            .then(({ videos: list, unavailable: missing }) => {
                if (cancelled) return
                setVideos(list)
                setUnavailable(missing)
            })
            .catch((err) => console.error('LOBBY VIDEOS ERROR:', err))
            .finally(() => { if (!cancelled) setLoaded(true) })
        return () => { cancelled = true }
    }, [])

    useLiveRefresh(['lobby_videos'], refresh)

    const add = async (e) => {
        e.preventDefault()
        const link = url.trim()
        if (!isFacebookVideoUrl(link)) {
            notifyWarning('Paste the link of a Facebook video (on Facebook: Share → Copy link).')
            return
        }
        const playSeconds = Math.min(900, Math.max(10, Number(seconds) || 60))
        try {
            setSaving(true)
            const nextOrder = videos.reduce((max, v) => Math.max(max, v.sort_order || 0), 0) + 1
            const { error } = await supabase.from('lobby_videos').insert({
                url: link,
                title: title.trim() || null,
                play_seconds: playSeconds,
                sort_order: nextOrder,
            })
            if (error) throw error
            setUrl('')
            setTitle('')
            setSeconds('60')
            notifySuccess('Video added. The lobby TV will play it in its next turn.')
            await refresh()
        } catch (err) {
            notifyError('Could not add the video: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    // Fetch the newest videos from the HCDC Facebook Page now (it also runs
    // by itself every hour).
    const syncNow = async () => {
        setSyncing(true)
        setSyncNote('')
        try {
            const { data, error } = await supabase.functions.invoke('sync-facebook-videos', { body: {} })
            let message = data?.error
            if (error) {
                try { message = (await error.context?.json())?.error || error.message } catch { message = error.message }
            }
            if (message) {
                setSyncNote(/FB_PAGE_TOKEN|Not set up/i.test(message)
                    ? 'Automatic fetching isn’t connected yet — it needs a Page access token from an admin of the HCDC Facebook Page.'
                    : /not found|404|Failed to send/i.test(message)
                        ? 'The sync function isn’t deployed yet.'
                        : message)
            } else {
                setSyncNote(`Synced: ${data.fetched} video${data.fetched === 1 ? '' : 's'} from Facebook (${data.added} new).`)
                await refresh()
            }
        } finally {
            setSyncing(false)
        }
    }

    const toggle = async (video) => {
        const { error } = await supabase.from('lobby_videos').update({ is_active: !video.is_active }).eq('video_id', video.video_id)
        if (error) return notifyError('Could not update the video: ' + error.message)
        refresh()
    }

    const remove = async (video) => {
        const ok = await confirmModal(`Remove "${video.title || 'this video'}" from the lobby TV?`, { title: 'Remove video?', confirmButtonText: 'Remove', icon: 'warning' })
        if (!ok) return
        const { error } = await supabase.from('lobby_videos').delete().eq('video_id', video.video_id)
        if (error) return notifyError('Could not remove the video: ' + error.message)
        refresh()
    }

    return (
        <section className="lv-card" aria-labelledby="lv-title">
            <div className="lv-head">
                <div>
                    <h2 id="lv-title">Lobby TV videos</h2>
                    <p>
                        The newest videos from the Holy Cross of Davao College Facebook Page are fetched automatically every
                        hour. The Queue Display plays them every 2 minutes, newest first, with the walkthrough demo after the
                        last one. Hide any you don't want on the TV.
                    </p>
                </div>
                {!unavailable && (
                    <button type="button" className="admin-secondary-button lv-sync" onClick={syncNow} disabled={syncing}>
                        {syncing ? 'Syncing…' : 'Sync from Facebook now'}
                    </button>
                )}
            </div>
            {syncNote && <p className="lv-sync-note" role="status">{syncNote}</p>}

            {unavailable ? (
                <p className="lv-note">Run the lobby videos SQL (20261002000000_lobby_videos) in Supabase to turn this on.</p>
            ) : (
                <>
                    <h3 className="lv-subhead">Add a video by hand (optional)</h3>
                    <form className="lv-form" onSubmit={add}>
                        <label className="lv-field lv-grow">
                            <span>Facebook video link</span>
                            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/hcdc.edu.ph/videos/…" required disabled={saving} />
                        </label>
                        <label className="lv-field">
                            <span>Title shown on the TV (optional)</span>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Foundation Week highlights" disabled={saving} />
                        </label>
                        <label className="lv-field lv-small">
                            <span>Play for (seconds)</span>
                            <input type="text" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(digitsOnly(e.target.value))} maxLength={3} disabled={saving} />
                        </label>
                        <button type="submit" className="admin-primary-button lv-add" disabled={saving}>
                            {saving ? 'Adding…' : 'Add video'}
                        </button>
                    </form>

                    {loaded && videos.length === 0 && (
                        <p className="lv-note">No videos yet — the TV shows the walkthrough demo every 2 minutes until videos are fetched or added.</p>
                    )}

                    {videos.length > 0 && (
                        <ol className="lv-list">
                            {videos.map((v, i) => (
                                <li key={v.video_id} className={v.is_active ? '' : 'is-off'}>
                                    <span className="lv-num">{i + 1}</span>
                                    <div className="lv-main">
                                        <strong>
                                            {v.source === 'facebook' && <span className="lv-badge">From Facebook</span>}
                                            {v.title || 'Untitled video'}
                                        </strong>
                                        <a href={v.url} target="_blank" rel="noopener noreferrer">{v.url}</a>
                                        <small>
                                            Plays {v.play_seconds} s
                                            {v.published_at ? ` · posted ${new Date(v.published_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                            {v.is_active ? '' : ' · hidden from the TV'}
                                        </small>
                                    </div>
                                    <div className="lv-actions">
                                        <button type="button" onClick={() => toggle(v)}>{v.is_active ? 'Hide' : 'Show'}</button>
                                        <button type="button" className="is-danger" onClick={() => remove(v)}>Remove</button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </>
            )}
        </section>
    )
}

export default LobbyVideosCard
