import { useEffect, useState } from 'react'
import './AnnouncementCarousel.css'

const INTERVAL_MS = 6000

function AnnouncementCarousel({ items }) {
    const [index, setIndex] = useState(0)

    useEffect(() => {
        setIndex(0)
    }, [items])

    useEffect(() => {
        if (items.length < 2) return

        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length)
        }, INTERVAL_MS)

        return () => clearInterval(timer)
    }, [items.length])

    if (items.length === 0) return null

    const current = items[index]

    return (
        <div className="announcement-carousel">
            <div className="announcement-carousel-body" key={current.announcement_id}>
                <strong>{current.title}</strong>
                <span>{current.message}</span>
            </div>

            {items.length > 1 && (
                <div className="announcement-carousel-dots">
                    {items.map((item, i) => (
                        <button
                            key={item.announcement_id}
                            type="button"
                            aria-label={`Show announcement ${i + 1}`}
                            className={`announcement-carousel-dot${i === index ? ' active' : ''}`}
                            onClick={() => setIndex(i)}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default AnnouncementCarousel
