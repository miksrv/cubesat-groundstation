import React, { useEffect, useState } from 'react'
import { Container, Skeleton } from 'simple-react-ui-kit'

import type { CameraShot } from '../../features/telemetry/types'

import styles from './CameraViewWidget.module.scss'

interface Props {
    /** The newest image, already resolved to something an `<img>` can load —
     *  base64 pixels off the bus, or a URL into the mission's directory. */
    shot: CameraShot | null
    /** Whether this source can deliver photographs at all. False on the
     *  bundled recording, and the empty state says so instead of implying a
     *  camera that never answers. */
    photosAvailable: boolean
    isLoading: boolean
}

/** What the caption calls each channel the image can have come by. */
const KIND_LABELS: Record<CameraShot['kind'], string> = {
    photo: 'PHOTO',
    mission_frame: 'MISSION',
    archive: 'ARCHIVE'
}

/**
 * Date and time, not time alone: the archive fallback can surface a photograph
 * days old, and "12:00:00" on last Tuesday's frame reads as today's.
 */
const dateTime = (epoch: number | null): string | null =>
    epoch != null && epoch > 0
        ? new Date(epoch * 1000).toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
          })
        : null

/**
 * The placeholder is drawn, not shipped: an inline SVG needs no asset in the
 * bundle, follows the panel palette, and — unlike a stock "no image" bitmap —
 * cannot be mistaken for something the satellite photographed.
 */
const Placeholder: React.FC<{ message: string }> = ({ message }) => (
    <div className={styles.placeholder}>
        <svg
            viewBox='0 0 64 48'
            className={styles.placeholderArt}
            aria-hidden='true'
        >
            <rect
                x='1.5'
                y='1.5'
                width='61'
                height='45'
                rx='4'
                fill='none'
                stroke='currentColor'
                strokeWidth='1'
                strokeDasharray='4 3'
            />
            <circle
                cx='32'
                cy='22'
                r='9'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
            />
            <circle
                cx='32'
                cy='22'
                r='3.5'
                fill='currentColor'
            />
            <rect
                x='44'
                y='8'
                width='8'
                height='4'
                rx='1'
                fill='currentColor'
            />
            <line
                x1='12'
                y1='38'
                x2='52'
                y2='38'
                stroke='currentColor'
                strokeWidth='1'
            />
        </svg>
        <span className={styles.placeholderText}>{message}</span>
    </div>
)

/**
 * One image, two honest empty states.
 *
 * The widget renders exactly what it is handed and never asks where it came
 * from — the resolution from bus message or archive listing to a loadable
 * `src` happened in the data layer. What it does own is the failure of the
 * `src` itself: the satellite's retention deletes a mission's photos with the
 * mission, so a URL that listed fine a minute ago can 404, and the answer to
 * that is the placeholder, not a broken-image glyph.
 */
const CameraViewWidget: React.FC<Props> = React.memo(({ shot, photosAvailable, isLoading }) => {
    const [failedSrc, setFailedSrc] = useState<string | null>(null)

    useEffect(() => {
        // A new shot gets a fresh chance: the failure belongs to one URL, not
        // to the widget.
        setFailedSrc(null)
    }, [shot?.src])

    const showSkeleton = isLoading && shot == null
    const broken = shot != null && shot.src === failedSrc
    const showImage = shot != null && !broken

    const emptyMessage = !photosAvailable
        ? 'This recording carries no photographs'
        : broken
          ? 'The photograph is gone from the satellite — retention removes a mission’s photos with the mission'
          : 'No photograph yet — send take_photo, or open a mission'

    return (
        <Container
            title='Onboard Camera'
            className={styles.panel}
        >
            {showSkeleton && <Skeleton style={{ height: '180px', width: '100%' }} />}
            {!showSkeleton && (
                <div className={styles.body}>
                    <div className={styles.frame}>
                        {showImage ? (
                            <img
                                className={styles.image}
                                src={shot.src}
                                alt={shot.file ?? 'photograph from the satellite'}
                                onError={() => setFailedSrc(shot.src)}
                            />
                        ) : (
                            <Placeholder message={emptyMessage} />
                        )}
                    </div>
                    {/* The caption row is always there, so the card keeps its
                        shape whether a photograph exists or not. It says "no
                        photo data" in words rather than a dash — a bare dash
                        does not tell the reader what would have been here. It
                        also outlives the image itself: a shot retention has
                        deleted still truthfully had its capture time. */}
                    <div className={styles.caption}>
                        {shot != null ? (
                            <>
                                <span className={styles.kind}>{KIND_LABELS[shot.kind]}</span>
                                <span className={styles.captionText}>
                                    {[
                                        dateTime(shot.timestamp) ?? shot.file ?? '—',
                                        shot.missionId != null ? `mission ${shot.missionId}` : 'no mission',
                                        shot.sizeBytes != null ? `${(shot.sizeBytes / 1024).toFixed(0)} KB` : null
                                    ]
                                        .filter((part) => part != null)
                                        .join(' · ')}
                                </span>
                            </>
                        ) : (
                            <span className={styles.captionText}>no photo data</span>
                        )}
                    </div>
                </div>
            )}
        </Container>
    )
})

CameraViewWidget.displayName = 'CameraViewWidget'
export default CameraViewWidget
