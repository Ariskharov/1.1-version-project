import { useEffect, useState } from 'react';
import { previewImageUrl, resolveImageUrl } from '../../config/api';

const PreviewImage = ({ src, alt = '', onFinalError, ...rest }) => {
    const full = resolveImageUrl(src);
    const preview = previewImageUrl(src);
    const [current, setCurrent] = useState(preview);

    useEffect(() => {
        setCurrent(preview);
    }, [preview]);

    if (!current) return null;

    return (
        <img
            src={current}
            alt={alt}
            {...rest}
            onError={(event) => {
                if (full && current !== full) {
                    setCurrent(full);
                    return;
                }
                onFinalError?.(event);
            }}
        />
    );
};

export default PreviewImage;
