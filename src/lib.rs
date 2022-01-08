use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    borsh::try_from_slice_unchecked,
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Answer {
    pub source_chain: u32,
    pub price: u64,
    pub time: u64,
    pub decimal: u64,
    pub program_addr: Pubkey,
    pub token_addr: Pubkey,
    pub local_addr: Pubkey, // It is solana local mint address of the nft which is transfer from other chain
    pub name: String,
    pub price_type: String,
}

entrypoint!(process_instruction);
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let report_account = next_account_info(accounts_iter)?;
    let answer_account = next_account_info(accounts_iter)?;

    let report_info = banksea_oracle::get_report_info(report_account)?;
    let mut answer_info: Answer = try_from_slice_unchecked(&answer_account.data.borrow())?;
    answer_info.source_chain = report_info.source_chain;
    answer_info.program_addr = report_info.program_addr;
    answer_info.token_addr = report_info.token_addr;
    answer_info.local_addr = report_info.local_addr;
    answer_info.price = report_info.price;
    answer_info.decimal = report_info.decimal;
    answer_info.time = report_info.time;
    answer_info.name = report_info.name;
    answer_info.price_type = report_info.price_type;
    
    answer_info.serialize(&mut &mut answer_account.data.borrow_mut()[..])?;
    Ok(())
}