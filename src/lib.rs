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
    pub addr: Pubkey,
    pub price: u64,
    pub decimal: u64,
    pub time: u64,
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

    let feed_account = next_account_info(accounts_iter)?;
    let answer_account = next_account_info(accounts_iter)?;

    let feed_info = banksea_oracle::get_feed_info(feed_account)?;
    let mut answer_info: Answer = try_from_slice_unchecked(&answer_account.data.borrow())?;

    answer_info.addr = feed_info.addr;
    answer_info.price = feed_info.price;
    answer_info.decimal = feed_info.decimal;
    answer_info.time = feed_info.time;
    answer_info.name = feed_info.name;
    answer_info.price_type = feed_info.price_type;

    answer_info.serialize(&mut &mut answer_account.data.borrow_mut()[..])?;
    Ok(())
}