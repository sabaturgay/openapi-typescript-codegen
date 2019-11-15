import { OpenApi } from '../interfaces/OpenApi';
import { OpenApiSchema } from '../interfaces/OpenApiSchema';
import { getComment } from './getComment';
import { getType } from './getType';
import { Type } from '../../../client/interfaces/Type';
import { getEnumType } from './getEnumType';
import { PrimaryType } from './constants';
import { OpenApiReference } from '../interfaces/OpenApiReference';
import { getRef } from './getRef';
import { getEnumValues } from './getEnumValues';
import { Model } from '../../../client/interfaces/Model';

export function getModel(openApi: OpenApi, schema: OpenApiSchema, name: string): Model {
    const result: Model = {
        name,
        isInterface: false,
        isType: false,
        isEnum: false,
        type: 'any',
        base: 'any',
        template: null,
        validation: null,
        description: getComment(schema.description),
        extends: null,
        imports: [],
        enums: [],
        properties: [],
    };

    // If the param is a enum then return the values as an inline type.
    if (schema.enum) {
        const enumSymbols: ModelSymbol[] = getEnumSymbols(schema.enum);
        if (enumSymbols.length) {
            result.isEnum = true;
            result.symbols = enumSymbols;
            result.type = getEnumType(enumSymbols);
            result.base = PrimaryType.STRING;
            result.validation = `yup.mixed<${name}>().oneOf([${getEnumValues(enumSymbols).join(', ')}])`;
            return result;
        }
    }

    // If the param is a enum then return the values as an inline type.
    if (schema.type === 'int' && schema.description) {
        const enumSymbols: ModelSymbol[] = getEnumSymbolsFromDescription(schema.description);
        if (enumSymbols.length) {
            result.isEnum = true;
            result.symbols = enumSymbols;
            result.type = getEnumType(enumSymbols);
            result.base = PrimaryType.NUMBER;
            result.validation = `yup.mixed<${name}>().oneOf([${getEnumValues(enumSymbols).join(', ')}])`;
            return result;
        }
    }

    // If the schema is an Array type, we check for the child type,
    // so we can create a typed array, otherwise this will be a "any[]".
    if (schema.type === 'array' && schema.items) {
        if (schema.items.$ref) {
            const arrayType: Type = getType(schema.items.$ref);
            result.imports.push(...arrayType.imports);
            result.isType = true;
            result.type = `${arrayType.type}[]`;
            result.base = arrayType.base;
            result.template = arrayType.template;
            result.validation = `yup.array<${result.name}>().of(${result.base}.schema)`; // TODO: Simple strings!
            result.imports.push(...arrayType.imports);
        } else {
            const array: Schema = getSchema(openApi, schema.items, 'unkown');
            const arrayType: string = getSchemaType(array);
            result.isType = true;
            result.type = `${arrayType}[]`;
            result.base = arrayType;
            result.template = null;
            result.validation = `yup.array<${result.name}>().of(${result.base}.schema)`; // TODO: Simple strings!
            result.imports.push(...array.imports);
        }
        return result;
    }

    /*
    // Check if this model extends other models
    if (schema.allOf) {
        schema.allOf.forEach((parent: OpenApiSchema & OpenApiReference): void => {
            const parentSchema: SchemaReference = getSchemaReference(openApi, parent);
            result.extends.push(parentSchema.type);
            result.imports.push(parentSchema.base);

            // Merge properties of other models
            if (parent.properties) {
                for (const propertyName in schema.properties) {
                    if (schema.properties.hasOwnProperty(propertyName)) {
                        const propertyRef: OpenApiSchema & OpenApiReference = schema.properties[propertyName];
                        const propertyRequired: boolean = (schema.required && schema.required.includes(propertyName)) || false;
                        const property: SchemaProperty = getSchemaProperty(openApi, propertyRef, propertyName, propertyRequired);
                        result.imports.push(...property.imports);
                        result.properties.set(propertyName, property);
                    }
                }
            }
        });
    }
    */

    if (schema.type === 'object' && schema.properties) {
        result.isInterface = true;
        result.type = 'interface';
        result.base = 'interface';
        result.template = null;

        for (const propertyName in schema.properties) {
            if (schema.properties.hasOwnProperty(propertyName)) {
                const propertyRequired: boolean = (schema.required && schema.required.includes(propertyName)) || false;
                const propertyRef: OpenApiSchema & OpenApiReference = schema.properties[propertyName];

                if (propertyRef.$ref) {
                    const propertyType: Type = getType(propertyRef.$ref);
                    result.imports.push(...propertyType.imports);
                    result.properties.push({
                        name: propertyName,
                        type: propertyType.type,
                        required: propertyRequired,
                        nullable: false,
                        readOnly: false,
                    });
                } else {
                    const property: OpenApiSchema = getRef<OpenApiSchema>(openApi, propertyRef);
                    const propertySchema: Schema = getSchema(openApi, property, propertyName);
                    const propertyType: string = getSchemaType(propertySchema);
                    result.imports.push(...propertySchema.imports);
                    result.properties.push({
                        name: propertyName,
                        type: propertyType,
                        required: propertyRequired,
                        nullable: false,
                        readOnly: property.readOnly || false,
                        description: property.description,
                    });

                    // TODO: This also needs a validation logic, maybe we can store that
                    // per schema and have them 'concatenate' on demand??
                }
            }
        }

        return result;
    }

    // If the schema has a type than it can be a basic or generic type.
    if (schema.type) {
        const schemaType: Type = getType(schema.type);
        result.isType = true;
        result.type = schemaType.type;
        result.base = schemaType.base;
        result.template = schemaType.template;
        result.imports.push(...schemaType.imports);
        return result;
    }

    return result;
}