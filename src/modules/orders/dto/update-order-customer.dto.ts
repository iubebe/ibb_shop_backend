import { CustomerInfoDto } from '../../customers/dto/customer-info.dto.js';

/** Fields left out stay as they are; `null` or blank clears one. */
export class UpdateOrderCustomerDto extends CustomerInfoDto {}
