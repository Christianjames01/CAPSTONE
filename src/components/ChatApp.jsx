import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import AvatarFace from './AvatarFace'
import { useScrollLock } from '../lib/useScrollLock'
import { dividerLabel } from '../lib/chatTime'
import './ChatApp.css'

// Messenger-style building blocks shared by the student, employee and
// Registrar Head Messages pages: a conversation list beside the open chat
// on desktop; on phones the list is the page and the chat opens full screen
// with a back arrow (`chatOpen`).

const MOBILE_QUERY = '(max-width: 880px)'
const GROUP_GAP_MS = 5 * 60 * 1000
const DIVIDER_GAP_MS = 30 * 60 * 1000

function useIsMobile() {
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_QUERY)
        const onChange = () => setMobile(mq.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    return mobile
}

// One avatar, or two overlapping ones for a conversation between two
// other people (the Registrar Head's oversight view).
export function ChatAvatar({ people = [], size = 44 }) {
    const shown = people.filter(Boolean).slice(0, 2)

    if (shown.length < 2) {
        const p = shown[0] || {}
        return (
            <span className="chat-avatar" style={{ '--chat-avatar': `${size}px` }} aria-hidden="true">
                <AvatarFace photo={p.photo} name={p.name} />
            </span>
        )
    }

    return (
        <span className="chat-avatar-pair" style={{ '--chat-avatar': `${size}px` }} aria-hidden="true">
            {shown.map((p, i) => (
                <span key={i} className="chat-avatar">
                    <AvatarFace photo={p.photo} name={p.name} />
                </span>
            ))}
        </span>
    )
}

export function ChatApp({ chatOpen, children }) {
    const isMobile = useIsMobile()
    const fullScreen = isMobile && chatOpen
    const ref = useRef(null)

    useScrollLock(fullScreen)

    // Full-screen chat on phones, with the keyboard open:
    //  - pin the page behind it (iOS ignores overflow: hidden and scrolls the
    //    whole document to reveal the focused box, dragging the chat along);
    //  - size the chat to the visible area above the keyboard. iOS keeps the
    //    layout viewport when the keyboard opens, so follow visualViewport.
    useEffect(() => {
        const el = ref.current
        if (!fullScreen || !el) return undefined

        const { body } = document
        const scrollY = window.scrollY
        const saved = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width }
        Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', width: '100%' })

        const vv = window.visualViewport
        let frame = 0
        const sync = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                if (!vv) return
                el.style.setProperty('--chat-vh', `${Math.round(vv.height)}px`)
                el.style.setProperty('--chat-top', `${Math.round(vv.offsetTop)}px`)
            })
        }
        sync()
        vv?.addEventListener('resize', sync)
        vv?.addEventListener('scroll', sync)
        window.addEventListener('focusin', sync)
        window.addEventListener('focusout', sync)

        return () => {
            cancelAnimationFrame(frame)
            vv?.removeEventListener('resize', sync)
            vv?.removeEventListener('scroll', sync)
            window.removeEventListener('focusin', sync)
            window.removeEventListener('focusout', sync)
            el.style.removeProperty('--chat-vh')
            el.style.removeProperty('--chat-top')
            Object.assign(body.style, saved)
            window.scrollTo(0, scrollY)
        }
    }, [fullScreen])

    return (
        <div ref={ref} className={`chat-app${chatOpen ? ' is-chat-open' : ''}`}>
            {children}
        </div>
    )
}

export function ChatSidebar({ title, subtitle, actions, toolbar, children }) {
    return (
        <aside className="chat-sidebar" aria-label="Conversations">
            <div className="chat-sidebar-head">
                <div>
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="chat-sidebar-actions">{actions}</div>}
            </div>
            {toolbar && <div className="chat-sidebar-toolbar">{toolbar}</div>}
            <ul className="chat-list">{children}</ul>
        </aside>
    )
}

export function ChatListEmpty({ children }) {
    return <li className="chat-list-empty">{children}</li>
}

export function ChatListItem({ active, unread = 0, people, name, meta, preview, time, typing, onClick }) {
    return (
        <li>
            <button
                type="button"
                className={`chat-item${active ? ' is-active' : ''}${unread > 0 ? ' is-unread' : ''}`}
                onClick={onClick}
                aria-current={active ? 'true' : undefined}
            >
                <ChatAvatar people={people} size={48} />
                <span className="chat-item-main">
                    <span className="chat-item-top">
                        <strong>{name}</strong>
                        {time && <time>{time}</time>}
                    </span>
                    {meta && <span className="chat-item-meta">{meta}</span>}
                    <span className="chat-item-bottom">
                        {typing
                            ? <span className="chat-item-preview is-typing">typing…</span>
                            : <span className="chat-item-preview">{preview}</span>}
                        {unread > 0 && <span className="chat-item-badge" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
                    </span>
                </span>
            </button>
        </li>
    )
}

export function ChatPane({ label, children }) {
    return (
        <section className="chat-pane" aria-label={label}>
            {children}
        </section>
    )
}

export function ChatPlaceholder({ title, text }) {
    return (
        <div className="chat-placeholder">
            <span className="chat-placeholder-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
                </svg>
            </span>
            <strong>{title}</strong>
            {text && <p>{text}</p>}
        </div>
    )
}

export function ChatHeader({ onBack, people, title, subtitle, typing, actions }) {
    return (
        <header className="chat-head">
            <button type="button" className="chat-back" onClick={onBack} aria-label="Back to conversations">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
            <ChatAvatar people={people} size={40} />
            <div className="chat-head-text">
                <h2>{title}</h2>
                {typing ? <p className="is-typing">{typing}</p> : subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="chat-head-actions">{actions}</div>}
        </header>
    )
}

// Scrollable message area. Adds time dividers after long gaps and tells
// each message where it sits in a run from the same sender, so bubbles can
// stack like Messenger (one name on top, one avatar and time at the end).
// Stays pinned to the newest message unless the reader scrolled up.
// `typing`: { people, label } while someone in the conversation is
// typing -- shown as a bubble with animated dots after the last message.
export function ChatMessages({ messages, threadKey, empty, renderMessage, typing }) {
    const ref = useRef(null)
    const pinned = useRef(true)
    const lastKey = useRef(null)
    const isTyping = !!typing

    const onScroll = () => {
        const el = ref.current
        if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    }

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        if (lastKey.current !== threadKey || pinned.current) {
            el.scrollTop = el.scrollHeight
            pinned.current = true
        }
        lastKey.current = threadKey
    }, [threadKey, messages, isTyping])

    // When the chat area shrinks (the phone keyboard opening, the message
    // box growing), keep the newest message in view.
    useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(() => {
            if (pinned.current) el.scrollTop = el.scrollHeight
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const items = []
    messages.forEach((m, i) => {
        const prev = messages[i - 1]
        const next = messages[i + 1]
        const at = new Date(m.created_at).getTime()
        const divider = !prev || at - new Date(prev.created_at).getTime() > DIVIDER_GAP_MS
        const nextDivider = !next || new Date(next.created_at).getTime() - at > DIVIDER_GAP_MS

        const groupStart = divider || prev.sender_user_id !== m.sender_user_id || at - new Date(prev.created_at).getTime() > GROUP_GAP_MS
        const groupEnd = nextDivider || next.sender_user_id !== m.sender_user_id || new Date(next.created_at).getTime() - at > GROUP_GAP_MS

        if (divider) items.push(<div key={`d-${m.message_id}`} className="chat-divider">{dividerLabel(m.created_at)}</div>)
        items.push(renderMessage(m, { groupStart, groupEnd }))
    })

    return (
        <div className="chat-body" ref={ref} onScroll={onScroll}>
            {messages.length === 0 && !typing ? <div className="chat-body-empty">{empty}</div> : items}
            {typing && (
                <div className="msg-row is-group-start is-group-end chat-typing-row">
                    <span className="msg-avatar-slot" aria-hidden="true"><ChatAvatar people={typing.people} size={28} /></span>
                    <div className="chat-typing" role="status" aria-label={typing.label}>
                        <span /><span /><span />
                    </div>
                </div>
            )}
        </div>
    )
}

// On phones and tablets Enter adds a new line and the send button sends,
// like Messenger; with a keyboard, Enter sends and Shift+Enter adds a line.
const touchTyping = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function ChatComposer({ value, onChange, onSend, sending, placeholder, canSend, above }) {
    const ref = useRef(null)

    // Grow the box with its text. On phones the chat starts hidden behind
    // the conversation list, where the box measures 0 tall -- so skip while
    // hidden and measure again once it's shown (the ResizeObserver fires
    // when it gets a real size), instead of leaving it collapsed.
    const grow = () => {
        const el = ref.current
        if (!el || el.offsetWidth === 0) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(Math.max(el.scrollHeight, 42), 132)}px`
    }

    useLayoutEffect(grow, [value])

    useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver === 'undefined') return undefined
        let lastWidth = el.offsetWidth
        const observer = new ResizeObserver(() => {
            if (el.offsetWidth !== lastWidth) {
                lastWidth = el.offsetWidth
                grow()
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const send = () => {
        if (!sending && canSend) onSend()
    }

    return (
        <div className="chat-composer">
            {above}
            <div className="chat-composer-row">
                <textarea
                    ref={ref}
                    rows={1}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    enterKeyHint={touchTyping() ? 'enter' : 'send'}
                    autoComplete="off"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !touchTyping()) {
                            e.preventDefault()
                            send()
                        }
                    }}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    readOnly={sending}
                />
                <button
                    type="button"
                    className="chat-send"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={send}
                    disabled={sending || !canSend}
                    aria-label={sending ? 'Sending' : 'Send'}
                >
                    {sending ? (
                        <span className="icon-spinner" />
                    ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L15 12 3.3 13.9z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    )
}
