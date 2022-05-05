import camelCase from 'camelcase';

/**
 * Convert the input value to a correct operation (method) classname.
 * This will use the operation ID - if available - and otherwise fallback
 * on a generated name from the URL
 */
export const getOperationName = (url: string, method: string, operationId?: string): string => {
    url = camelCase(url);
    const pathSections = url.split('/').filter(name => !!name);
    const groups: string[] = [];
    const params: string[] = [];
    pathSections.forEach(section => {
        if (section.startsWith('{') && section.endsWith('}')) {
            params.push(section.substring(1, section.length - 1));
        } else {
            groups.push(`${section}`);
        }
    });
    if (groups.length > 1) {
        groups.shift();
    }
    const methodName = `${method.toLowerCase()}${groups.map(capitalizeFirstLetter).join('')}${
        params.length > 0 ? 'By' : ''
    }${params.map(capitalizeFirstLetter).join('And')}`;
    return methodName;
};

function capitalizeFirstLetter(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
